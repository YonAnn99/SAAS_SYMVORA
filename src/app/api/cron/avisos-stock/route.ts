import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { enviarAvisosStockPendientes } from "@/features/notificaciones/services/correo-stock-server";

/**
 * Respaldo diario de las notificaciones (migración 108).
 *
 * 1. Manda los correos de stock que se quedaron pendientes. El envío normal es
 *    inmediato y lo pide la campana (`/api/notificaciones/correo-stock`); si
 *    nadie quedó conectado (cerró la pestaña justo al vender, o le tocaba
 *    esperar los 15 minutos), el aviso no se pierde: sale aquí.
 * 2. Borra las notificaciones de más de 30 días: la campana solo muestra las
 *    30 más recientes y la Bitácora ya guarda el historial.
 *
 * HORARIO: `vercel.json` la programa a las 14:00 UTC = 8:00 en Ciudad de
 * México, antes de abrir. Requiere `CRON_SECRET` (falla cerrada, como los demás).
 */

export const maxDuration = 60;

const RETENCION_DIAS = 30;
const MAX_NEGOCIOS = 100;

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
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: pendientes, error } = await supabase
    .from("notificaciones")
    .select("tenant_id")
    .in("tipo", ["stock_bajo", "stock_agotado"])
    .is("correo_enviado_en", null)
    .gt("creado_en", hace24h)
    .limit(1000);

  if (error) {
    console.error("[cron avisos-stock] no se pudieron leer los pendientes:", error.message);
    return NextResponse.json({ error: "Error leyendo pendientes" }, { status: 500 });
  }

  const negocios = [...new Set((pendientes ?? []).map((p) => p.tenant_id as string))].slice(
    0,
    MAX_NEGOCIOS
  );

  const resumen: Record<string, number> = {};
  // Secuencial a proposito: pocos negocios al dia y Resend con timeout de 5 s.
  for (const tenantId of negocios) {
    const resultado = await enviarAvisosStockPendientes(supabase, tenantId);
    resumen[resultado.estado] = (resumen[resultado.estado] ?? 0) + 1;
    if (resultado.estado === "error") {
      console.error(`[cron avisos-stock] ${tenantId}:`, resultado.error);
    }
  }

  const limite = new Date(Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { count: borradas } = await supabase
    .from("notificaciones")
    .delete({ count: "exact" })
    .lt("creado_en", limite);

  return NextResponse.json({ ok: true, negocios: negocios.length, resumen, borradas: borradas ?? 0 });
}
