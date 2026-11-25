import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { consumirRateLimit } from "@/lib/rate-limit";
import { construirCorreoReactivarPrueba, sendCorreoNovedad } from "@/lib/email";
import { nombreCompleto, primerNombre } from "@/lib/nombre-usuario";
import { DIAS_PRUEBA_REGALADOS, sePuedeReactivar } from "@/lib/activacion-correos";

/**
 * REACTIVAR pruebas vencidas que NUNCA probaron la app: se les regalan días y se les manda un correo. Campaña manual
 * (NO está en `vercel.json`), una vez.
 *
 * - Sin `?enviar=1` es SIMULACRO: lista cuántas y cuáles cuentas, sin cambiar nada.
 * - Con `?enviar=1`, por cada cuenta: marca (`consumirRateLimit`, una vez por cuenta) → `trial_end = ahora + 7 días`
 *   (restaura el acceso completo; `status` sigue `trial`) → limpia las marcas de aviso de fin → manda el correo.
 * - Criterio (`sePuedeReactivar`): negocio real, prueba vencida, nunca pagó, 0 productos y 0 ventas, registrada hace
 *   ≤ 90 días, sin reactivar antes.
 *
 * Requiere `CRON_SECRET` (falla cerrada).
 */

export const maxDuration = 60;

const VENTANA_MARCA_SEGUNDOS = 365 * 24 * 60 * 60;
const PAUSA_MS = 600;
const MS_POR_DIA = 86_400_000;
const clave = (tenantId: string) => `reactivar-prueba:${tenantId}`;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const enviar = new URL(request.url).searchParams.get("enviar") === "1";
  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("id, tenant_id, status, trial_end, last_payment_at")
    .eq("status", "trial")
    .lt("trial_end", ahora.toISOString())
    .is("last_payment_at", null)
    .limit(500);
  if (error) {
    console.error("[cron:reactivar-pruebas] fallo la consulta:", error.message);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }
  const ids = (subs ?? []).map((s) => s.tenant_id as string);
  if (ids.length === 0) return NextResponse.json({ dry: !enviar, candidatas: [], reactivadas: [], fallidas: [] });

  const [{ data: tenants }, { data: marcas }] = await Promise.all([
    supabase.from("tenants").select("id, nombre_comercial, creado_en, demo_expira_en").in("id", ids),
    supabase.from("rate_limits").select("clave").like("clave", "reactivar-prueba:%"),
  ]);
  const yaReactivadas = new Set((marcas ?? []).map((m) => m.clave as string));
  const subPorTenant = new Map((subs ?? []).map((s) => [s.tenant_id as string, s]));

  const candidatas: { tenantId: string; negocio: string; diasVencida: number }[] = [];
  for (const t of tenants ?? []) {
    const sub = subPorTenant.get(t.id as string);
    if (!sub) continue;
    const [{ count: productos }, { count: ventas }] = await Promise.all([
      supabase.from("productos").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      supabase.from("ventas").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
    ]);
    const ok = sePuedeReactivar(
      {
        status: sub.status as string,
        esDemo: t.demo_expira_en !== null,
        pago: Boolean(sub.last_payment_at),
        creadaEn: t.creado_en as string,
        trialEnd: sub.trial_end as string,
        productos: productos ?? 0,
        ventas: ventas ?? 0,
        yaReactivada: yaReactivadas.has(clave(t.id as string)),
      },
      ahora
    );
    if (ok) {
      candidatas.push({
        tenantId: t.id as string,
        negocio: (t.nombre_comercial as string) || "tu negocio",
        diasVencida: Math.floor((ahora.getTime() - new Date(sub.trial_end as string).getTime()) / MS_POR_DIA),
      });
    }
  }

  if (!enviar) {
    return NextResponse.json({
      dry: true,
      diasRegalados: DIAS_PRUEBA_REGALADOS,
      total: candidatas.length,
      candidatas: candidatas.map(({ negocio, diasVencida }) => ({ negocio, diasVencida })),
    });
  }

  const reactivadas: string[] = [];
  const fallidas: { negocio: string; motivo: string }[] = [];
  for (const c of candidatas) {
    const turno = await consumirRateLimit(clave(c.tenantId), 1, VENTANA_MARCA_SEGUNDOS);
    if (!turno.permitido) {
      fallidas.push({ negocio: c.negocio, motivo: "ya_reactivada" });
      continue;
    }
    const sub = subPorTenant.get(c.tenantId);
    const { error: errorUpdate } = await supabase
      .from("subscriptions")
      .update({
        trial_end: new Date(ahora.getTime() + DIAS_PRUEBA_REGALADOS * MS_POR_DIA).toISOString(),
        trial_aviso_previo_en: null,
        trial_aviso_fin_en: null,
        updated_at: ahora.toISOString(),
      })
      .eq("id", sub?.id as string);
    if (errorUpdate) {
      console.error(`[cron:reactivar-pruebas] no se pudo extender la prueba (${c.tenantId}): ${errorUpdate.message}`);
      fallidas.push({ negocio: c.negocio, motivo: "no_se_pudo_extender" });
      continue;
    }

    const { data: dueno } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", c.tenantId)
      .eq("role", "SUPER_ADMIN")
      .limit(1)
      .maybeSingle();
    const { data: usuario } = dueno ? await supabase.auth.admin.getUserById(dueno.user_id) : { data: null };
    const correo = usuario?.user?.email;
    if (!correo) {
      fallidas.push({ negocio: c.negocio, motivo: "extendida_sin_correo" });
      continue;
    }
    const nombre = primerNombre(nombreCompleto((usuario?.user?.user_metadata as Record<string, unknown> | undefined) ?? {}));
    const r = await sendCorreoNovedad({ to: correo, nombre, negocio: c.negocio }, construirCorreoReactivarPrueba);
    if (r.ok) reactivadas.push(c.negocio);
    else fallidas.push({ negocio: c.negocio, motivo: "extendida_correo_fallido" });
    await new Promise((listo) => setTimeout(listo, PAUSA_MS));
  }

  return NextResponse.json({ dry: false, reactivadas, fallidas });
}
