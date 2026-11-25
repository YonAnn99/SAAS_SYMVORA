import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { consumirRateLimit } from "@/lib/rate-limit";
import { construirCorreoActivacion, sendCorreoNovedad } from "@/lib/email";
import { nombreCompleto, primerNombre } from "@/lib/nombre-usuario";
import {
  claveActivacion,
  etapaPendiente,
  leerClaveActivacion,
  type CorreoDeActivacionEnviado,
} from "@/lib/activacion-correos";

/**
 * Correos de ACTIVACIÓN de cuentas nuevas (reglas en `lib/activacion-correos.ts`): «carga tu primer producto»,
 * «cobra tu primera venta» y «¿te ayudamos?». Lo dispara el cron diario de Vercel (`vercel.json`, 16:00 UTC = 10:00 CDMX).
 *
 * - `?dry=1`: SIMULACRO. Devuelve a qué negocios y con qué etapa; no manda ni marca nada.
 * - Idempotencia: cada (etapa, negocio) se marca en `rate_limits` ANTES de enviar (como `anuncio-novedad`), así que
 *   una segunda corrida no repite. Si Resend falla, ese correo no se reintenta solo (sale en `fallidos`).
 * - Solo pruebas vigentes de negocios reales, sin ventas ni pagos, dentro de la ventana de edad de cada etapa.
 *
 * Requiere `CRON_SECRET` (falla cerrada, como los demás crons).
 */

export const maxDuration = 60;

/** Tope de correos por ejecución. */
const MAX_POR_EJECUCION = 40;
/** Solo se evalúan cuentas de los últimos días: la ventana más larga de las etapas es 10. */
const DIAS_A_EVALUAR = 11;
const VENTANA_MARCA_SEGUNDOS = 400 * 24 * 60 * 60;
const PAUSA_MS = 600;
const MS_POR_DIA = 86_400_000;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createSupabaseServiceRoleClient();
  const ahora = new Date();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("tenant_id, status, trial_end, last_payment_at")
    .eq("status", "trial")
    .gt("trial_end", ahora.toISOString())
    .is("last_payment_at", null)
    .limit(500);
  if (error) {
    console.error("[cron:activacion] fallo la consulta:", error.message);
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }
  const ids = (subs ?? []).map((s) => s.tenant_id as string);
  if (ids.length === 0) return NextResponse.json({ dry, evaluadas: 0, enviados: [], omitidos: [], fallidos: [] });

  const desde = new Date(ahora.getTime() - DIAS_A_EVALUAR * MS_POR_DIA).toISOString();
  const [{ data: tenants }, { data: marcas }] = await Promise.all([
    supabase.from("tenants").select("id, nombre_comercial, creado_en, demo_expira_en").in("id", ids).gte("creado_en", desde),
    supabase.from("rate_limits").select("clave, ventana_inicio").like("clave", "activacion:%"),
  ]);

  const enviadosPrevios = new Map<string, CorreoDeActivacionEnviado[]>();
  for (const m of marcas ?? []) {
    const k = leerClaveActivacion(m.clave as string);
    if (!k) continue;
    const lista = enviadosPrevios.get(k.tenantId) ?? [];
    lista.push({ etapa: k.etapa, en: m.ventana_inicio as string });
    enviadosPrevios.set(k.tenantId, lista);
  }

  const subPorTenant = new Map((subs ?? []).map((s) => [s.tenant_id as string, s]));
  const enviados: { etapa: string; negocio: string }[] = [];
  const omitidos: { negocio: string; motivo: string }[] = [];
  const fallidos: { negocio: string; error?: string }[] = [];
  let evaluadas = 0;

  for (const t of tenants ?? []) {
    if (enviados.length >= MAX_POR_EJECUCION) break;
    const sub = subPorTenant.get(t.id as string);
    if (!sub) continue;
    evaluadas++;

    const [{ count: productos }, { count: ventas }] = await Promise.all([
      supabase.from("productos").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).is("archivado_en", null),
      supabase.from("ventas").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
    ]);

    const etapa = etapaPendiente(
      {
        status: sub.status as string,
        esDemo: t.demo_expira_en !== null,
        pago: Boolean(sub.last_payment_at),
        creadaEn: t.creado_en as string,
        trialEnd: sub.trial_end as string,
        productos: productos ?? 0,
        ventas: ventas ?? 0,
        enviados: enviadosPrevios.get(t.id as string) ?? [],
      },
      ahora
    );
    if (!etapa) continue;
    const negocio = (t.nombre_comercial as string) || "tu negocio";

    // El dueño (SUPER_ADMIN) y su correo de acceso.
    const { data: dueno } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", t.id)
      .eq("role", "SUPER_ADMIN")
      .limit(1)
      .maybeSingle();
    const { data: usuario } = dueno ? await supabase.auth.admin.getUserById(dueno.user_id) : { data: null };
    const correo = usuario?.user?.email;
    if (!correo) {
      omitidos.push({ negocio, motivo: "sin_dueno_con_correo" });
      continue;
    }
    if ((usuario?.user?.app_metadata as Record<string, unknown> | undefined)?.is_demo) {
      omitidos.push({ negocio, motivo: "demo" });
      continue;
    }

    if (dry) {
      enviados.push({ etapa, negocio });
      continue;
    }

    const turno = await consumirRateLimit(claveActivacion(etapa, t.id as string), 1, VENTANA_MARCA_SEGUNDOS);
    if (!turno.permitido) {
      omitidos.push({ negocio, motivo: "ya_enviado" });
      continue;
    }
    const nombre = primerNombre(nombreCompleto((usuario?.user?.user_metadata as Record<string, unknown> | undefined) ?? {}));
    const diasRestantes = Math.max(1, Math.ceil((new Date(sub.trial_end as string).getTime() - ahora.getTime()) / MS_POR_DIA));
    const r = await sendCorreoNovedad({ to: correo, nombre, negocio }, (p) =>
      construirCorreoActivacion(etapa, { ...p, diasRestantes })
    );
    if (r.ok) enviados.push({ etapa, negocio });
    else fallidos.push({ negocio, error: r.error });
    await new Promise((listo) => setTimeout(listo, PAUSA_MS));
  }

  return NextResponse.json({ dry, evaluadas, enviados, omitidos, fallidos });
}
