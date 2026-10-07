import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

/**
 * Respaldo diario de la limpieza de demos de visitante (migracion 112).
 *
 * La limpieza normal ocurre en cada "Probar demo" (`/api/demo/start` borra
 * hasta 20 vencidas). Si nadie entra durante un rato, las vencidas se quedan:
 * este cron las borra una vez al dia. Requiere `CRON_SECRET`, como los demas.
 */

export const maxDuration = 60;

const MAX_POR_EJECUCION = 500;

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
  const { data, error } = await supabase.rpc("borrar_demos_vencidas", {
    p_limite: MAX_POR_EJECUCION,
  });

  if (error) {
    console.error("[cron limpiar-demos] fallo:", error.message);
    return NextResponse.json({ error: "Error limpiando demos" }, { status: 500 });
  }

  return NextResponse.json({ borradas: data ?? 0 });
}
