import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  construirCorreoResumenInterno,
  totalNovedades,
  type ResumenInterno,
} from "@/lib/resumen-interno";

/**
 * Resumen diario interno para el equipo de SYMVORA (correo a hola@):
 * negocios nuevos, registros incompletos, sin productos, inactivos, pruebas
 * por vencer, pagos y vencidos/cancelados. Los datos salen de una sola
 * consulta, `resumen_interno_diario()` (migracion 123, solo service_role, sin
 * negocios demo). Se manda aunque no haya novedades: asi se sabe que corrio.
 *
 * El aviso al momento de cada negocio nuevo sale aparte, desde
 * `/api/email/welcome`.
 *
 * `?dry=1` devuelve el resumen y el correo sin enviarlo.
 *
 * HORARIO: `vercel.json` la programa a las 13:00 UTC = 7:00 en Ciudad de
 * Mexico. Requiere `CRON_SECRET` (falla cerrada, como los demas).
 */

export const maxDuration = 60;

function cronAutorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  return request.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("resumen_interno_diario");
  if (error || !data) {
    console.error("[cron resumen-interno] no se pudo armar el resumen:", error?.message);
    return NextResponse.json({ error: "Error armando el resumen" }, { status: 500 });
  }

  const resumen = data as ResumenInterno;
  const correo = construirCorreoResumenInterno(resumen, new Date());
  const conteos = {
    nuevos: resumen.nuevos.length,
    incompletos: resumen.incompletos.length,
    sin_productos: resumen.sin_productos.length,
    inactivos: resumen.inactivos.length,
    por_vencer: resumen.por_vencer.length,
    pagos: resumen.pagos.length,
    vencidos_cancelados: resumen.vencidos_cancelados.length,
    total: totalNovedades(resumen),
  };

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  if (dry) {
    return NextResponse.json({ dry: true, conteos, asunto: correo.subject, html: correo.html });
  }

  const { sendCorreoInterno } = await import("@/lib/email");
  const envio = await sendCorreoInterno(correo);
  if (!envio.ok) {
    console.error("[cron resumen-interno] no se envio:", envio.error);
    return NextResponse.json({ ok: false, conteos, error: envio.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, conteos });
}
