import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { sendAvisoCobroEmail } from "@/lib/email";
import {
  avisoCobroPendiente,
  columnaAvisoCobro,
  type AvisoCobro,
  type SuscripcionParaCobro,
} from "@/lib/avisos-cobro";
import { inicioSoloLectura, limiteConservacion } from "@/lib/acceso-suscripcion";

/**
 * Avisos de cobro a clientes que ya pagaban: renovacion (efectivo), gracia,
 * solo lectura, oferta de regreso y ultimo aviso. Lo dispara el cron diario de
 * Vercel (`vercel.json`, 15:30 UTC = 9:30 en Ciudad de Mexico).
 *
 * Misma forma que `trial-notices`: la decision vive en `lib/avisos-cobro.ts`
 * (con test); aqui se consulta, se envia y se marca. `?dry=1` calcula a quien
 * le tocaria sin mandar nada.
 *
 * REQUIERE `CRON_SECRET` (falla cerrada) y la migracion 096 (columnas
 * `aviso_*_en`, `past_due_desde`, `oferta_regreso_hasta`).
 */

export const maxDuration = 60;

const MAX_POR_EJECUCION = 200;
const MS_POR_DIA = 86_400_000;
const DIAS_OFERTA = 30;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

/** Correo de acceso del dueño (SUPER_ADMIN), no `tenants.email`. Igual que trial-notices. */
async function resolverDestinatario(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
  nombre: string | null
): Promise<{ email: string; businessName: string } | null> {
  const { data: owner } = await supabase
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "SUPER_ADMIN")
    .limit(1)
    .maybeSingle();
  if (!owner) return null;

  const { data: user } = await supabase.auth.admin.getUserById(owner.user_id);
  const email = user?.user?.email;
  if (!email) return null;

  return { email, businessName: nombre || "tu negocio" };
}

interface FilaCron {
  id: string;
  tenant_id: string;
  trial_end: string | null;
  current_period_end: string | null;
  past_due_desde: string | null;
  updated_at: string | null;
  last_payment_at: string | null;
  conekta_subscription_id: string | null;
  oferta_regreso_hasta: string | null;
  aviso_renovacion_en: string | null;
  aviso_gracia_en: string | null;
  aviso_solo_lectura_en: string | null;
  aviso_regreso_en: string | null;
  aviso_ultimo_en: string | null;
  tenants: { subscription_status: string | null; nombre_comercial: string | null } | null;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date();

  // Solo quien alguna vez pago o tiene adeudo/cancelacion: las pruebas que
  // nunca pagaron las cubre `trial-notices`.
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, tenant_id, trial_end, current_period_end, past_due_desde, updated_at, last_payment_at, conekta_subscription_id, oferta_regreso_hasta, aviso_renovacion_en, aviso_gracia_en, aviso_solo_lectura_en, aviso_regreso_en, aviso_ultimo_en, tenants(subscription_status, nombre_comercial)"
    )
    .or("last_payment_at.not.is.null,status.in.(past_due,canceled)")
    .order("updated_at")
    .limit(MAX_POR_EJECUCION);

  if (error) {
    console.error("[cron:avisos-cobro] fallo la consulta:", error.message);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }

  const filas = (data ?? []) as unknown as FilaCron[];
  const enviados: Array<{ tenantId: string; tipo: AvisoCobro }> = [];
  const omitidos: Array<{ tenantId: string; motivo: string }> = [];

  for (const fila of filas) {
    const sub: SuscripcionParaCobro = {
      ...fila,
      estado: fila.tenants?.subscription_status ?? null,
    };
    const tipo = avisoCobroPendiente(sub, ahora);
    if (!tipo) continue;

    const destinatario = await resolverDestinatario(
      supabase,
      fila.tenant_id,
      fila.tenants?.nombre_comercial ?? null
    );
    if (!destinatario) {
      omitidos.push({ tenantId: fila.tenant_id, motivo: "sin_dueno" });
      continue;
    }

    // La oferta de regreso vale hasta el fin del periodo de conservacion
    // (30 dias desde que entro a solo lectura). Se fija al mandar su correo.
    const inicio = inicioSoloLectura(sub, ahora);
    const ofertaHasta =
      tipo === "regreso" && inicio
        ? new Date(inicio.getTime() + DIAS_OFERTA * MS_POR_DIA)
        : fila.oferta_regreso_hasta
          ? new Date(fila.oferta_regreso_hasta)
          : null;

    if (dryRun) {
      enviados.push({ tenantId: fila.tenant_id, tipo });
      continue;
    }

    const resultado = await sendAvisoCobroEmail({
      to: destinatario.email,
      businessName: destinatario.businessName,
      tipo,
      venceEl: fila.current_period_end ? new Date(fila.current_period_end) : null,
      cobroFallido: sub.estado === "past_due",
      limiteDatos: limiteConservacion(sub, ahora),
      ofertaHasta: ofertaHasta && ofertaHasta >= ahora ? ofertaHasta : null,
    });

    if (!resultado.ok) {
      // Sin marca: el cron de mañana lo reintenta.
      omitidos.push({ tenantId: fila.tenant_id, motivo: "envio_fallido" });
      continue;
    }

    // La marca (y la oferta) se guardan DESPUES de que Resend confirme.
    const cambios: Record<string, string> = {
      [columnaAvisoCobro(tipo)]: ahora.toISOString(),
    };
    if (tipo === "regreso" && ofertaHasta) {
      cambios.oferta_regreso_hasta = ofertaHasta.toISOString();
    }
    const { error: errorMarca } = await supabase
      .from("subscriptions")
      .update(cambios)
      .eq("id", fila.id);

    if (errorMarca) {
      console.error(
        `[cron:avisos-cobro] correo enviado pero NO marcado (tenant ${fila.tenant_id}, ${tipo}): ${errorMarca.message}`
      );
    }

    enviados.push({ tenantId: fila.tenant_id, tipo });
  }

  if (filas.length === MAX_POR_EJECUCION) {
    console.warn(`[cron:avisos-cobro] se alcanzo el tope de ${MAX_POR_EJECUCION} cuentas`);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    revisadas: filas.length,
    enviados,
    omitidos,
  });
}
