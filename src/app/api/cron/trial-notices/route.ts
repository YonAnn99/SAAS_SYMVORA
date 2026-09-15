import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { sendTrialEndedEmail, sendTrialEndingEmail } from "@/lib/email";
import {
  DIAS_AVISO_PREVIO,
  DIAS_GRACIA_AVISO_FIN,
  avisoPendiente,
  columnaMarca,
  diasRestantes,
  type TipoAviso,
} from "@/lib/trial-notices";

/**
 * Avisos de fin de prueba. Lo dispara el cron diario de Vercel (`vercel.json`).
 *
 * Es el PRIMER trabajo programado del proyecto: hasta ahora no habia cron, cola
 * ni proceso en segundo plano, y por eso no existia ningun correo que avisara
 * del fin de la prueba. Quien dejaba de entrar se quedaba bloqueado sin que
 * nada se lo explicara.
 *
 * La decision de a quien avisar vive en `lib/trial-notices.ts`, no aqui: es la
 * unica parte con reglas y la unica que merece test. Esta ruta consulta, itera
 * y marca.
 *
 * HORARIO: `vercel.json` la programa a las 15:00 UTC. Los cron de Vercel SOLO
 * entienden UTC, y esa hora son las 9:00 en Ciudad de Mexico — a media mañana,
 * no de madrugada. Ojo al horario de verano: Mexico ya no lo aplica, asi que la
 * equivalencia se mantiene todo el año.
 *
 * REQUIERE `CRON_SECRET` en las variables de entorno de Vercel. Sin ella la
 * ruta rechaza TODO (ver `cronAutorizado`), incluido el propio cron.
 */

// El envio es secuencial y puede tocar varias cuentas; con el timeout de Resend
// (5s) esto da margen de sobra sin dejar la funcion colgada indefinidamente.
export const maxDuration = 60;

/** Tope de correos por ejecucion. Ver la nota en el bucle. */
const MAX_POR_EJECUCION = 200;

interface FilaSuscripcion {
  id: string;
  tenant_id: string;
  status: string;
  trial_end: string;
  trial_aviso_previo_en: string | null;
  trial_aviso_fin_en: string | null;
}

/**
 * Autenticacion del cron. Vercel manda `Authorization: Bearer $CRON_SECRET`
 * automaticamente cuando la variable existe en el proyecto.
 *
 * FALLA CERRADA: si `CRON_SECRET` no esta configurada se rechaza todo. Lo
 * contrario dejaria un endpoint publico capaz de disparar correos a clientes.
 */
function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

/** Correo de acceso del dueño (SUPER_ADMIN), no `tenants.email`. */
async function resolverDestinatario(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<{ email: string; businessName: string } | null> {
  // `tenants.email` es un contacto de negocio y no siempre coincide con el
  // correo con el que se entra al sistema — ya mordio una vez con el correo de
  // pago en efectivo. Se resuelve por la membresia, como hace el webhook.
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nombre_comercial")
    .eq("id", tenantId)
    .maybeSingle();

  return {
    email,
    businessName: tenant?.nombre_comercial || "tu negocio",
  };
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // `?dry=1` calcula a quien le tocaria sin mandar nada. Es la forma segura de
  // comprobar el comportamiento en produccion antes de soltar correos reales.
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date();

  // Se acota en SQL a la ventana que le interesa a `avisoPendiente`, para no
  // traer el historico entero: desde la gracia del aviso de vencimiento hasta
  // el aviso previo.
  const desde = new Date(
    ahora.getTime() - DIAS_GRACIA_AVISO_FIN * 86_400_000
  ).toISOString();
  const hasta = new Date(
    ahora.getTime() + DIAS_AVISO_PREVIO * 86_400_000
  ).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, tenant_id, status, trial_end, trial_aviso_previo_en, trial_aviso_fin_en"
    )
    .eq("status", "trial")
    .gte("trial_end", desde)
    .lte("trial_end", hasta)
    .order("trial_end")
    .limit(MAX_POR_EJECUCION);

  if (error) {
    console.error("[cron:trial-notices] fallo la consulta:", error.message);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }

  const candidatas = (data ?? []) as FilaSuscripcion[];
  const enviados: Array<{ tenantId: string; tipo: TipoAviso }> = [];
  const omitidos: Array<{ tenantId: string; motivo: string }> = [];

  for (const sub of candidatas) {
    const tipo = avisoPendiente(sub, ahora);
    if (!tipo) continue;

    const destinatario = await resolverDestinatario(supabase, sub.tenant_id);
    if (!destinatario) {
      // Sin dueño con correo no hay a quien avisar. Pasa con el tenant de la
      // demo, que a proposito no tiene SUPER_ADMIN.
      omitidos.push({ tenantId: sub.tenant_id, motivo: "sin_dueno" });
      continue;
    }

    if (dryRun) {
      enviados.push({ tenantId: sub.tenant_id, tipo });
      continue;
    }

    const resultado =
      tipo === "por_vencer"
        ? await sendTrialEndingEmail({
            to: destinatario.email,
            businessName: destinatario.businessName,
            daysLeft: Math.max(1, diasRestantes(sub.trial_end, ahora)),
          })
        : await sendTrialEndedEmail({
            to: destinatario.email,
            businessName: destinatario.businessName,
          });

    if (!resultado.ok) {
      // NO se marca: si el envio fallo, el cron de mañana lo reintenta. Marcar
      // aqui daria el aviso por hecho y la cuenta no recibiria nada nunca.
      omitidos.push({ tenantId: sub.tenant_id, motivo: "envio_fallido" });
      continue;
    }

    // Solo se marca DESPUES de que Resend confirme. El orden importa: al reves,
    // un fallo de red dejaria la marca puesta y el correo sin mandar.
    const { error: errorMarca } = await supabase
      .from("subscriptions")
      .update({ [columnaMarca(tipo)]: ahora.toISOString() })
      .eq("id", sub.id);

    if (errorMarca) {
      // El correo ya salio. Se registra fuerte porque la consecuencia es un
      // duplicado mañana, y eso hay que poder verlo en los logs.
      console.error(
        `[cron:trial-notices] correo enviado pero NO marcado (tenant ${sub.tenant_id}, ${tipo}): ${errorMarca.message}`
      );
    }

    enviados.push({ tenantId: sub.tenant_id, tipo });
  }

  // Un tope alcanzado significa que hay mas cuentas esperando de las que cabe
  // atender: el cron de mañana seguira, pero conviene enterarse.
  if (candidatas.length === MAX_POR_EJECUCION) {
    console.warn(
      `[cron:trial-notices] se alcanzo el tope de ${MAX_POR_EJECUCION} candidatas`
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    revisadas: candidatas.length,
    enviados,
    omitidos,
  });
}
