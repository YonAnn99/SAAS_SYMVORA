import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { consumirRateLimit } from "@/lib/rate-limit";
import { enviarAvisosStockPendientes } from "@/features/notificaciones/services/correo-stock-server";

export const maxDuration = 30;

/**
 * Correo INMEDIATO de stock bajo/agotado al dueño y a los administradores.
 *
 * Lo pide la campana del header (`use-notificaciones.ts`) cuando le llega un
 * aviso de stock con el correo pendiente. Quien acaba de vender o ajustar
 * siempre esta conectado, asi que basta con eso para cubrir el POS, los
 * ajustes, los traspasos y las cancelaciones sin tocar esos flujos. El cron
 * `/api/cron/avisos-stock` recoge lo que haya quedado colgado.
 *
 * NO SE FIA DEL NAVEGADOR: solo recibe el negocio (y se comprueba que el
 * usuario pertenece a el). Que avisar y cuando lo decide la base
 * (`reclamar_avisos_stock`): uno cada 15 minutos por negocio, sin duplicados.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tenantId?: unknown } | null;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId es requerido" }, { status: 400 });
  }

  const auth = await requireTenantAccess(request, { tenantId });
  if (!auth.ok) return auth.response;
  if (auth.isDemo) return NextResponse.json({ ok: true, estado: "demo" });

  // Varias pestañas y usuarios del mismo negocio lo piden a la vez; la base ya
  // evita duplicados, esto solo pone techo a las llamadas.
  const limite = await consumirRateLimit(`correo-stock:${tenantId}`, 30, 600);
  if (!limite.permitido) {
    return NextResponse.json({ ok: true, estado: "limitado" }, { status: 429 });
  }

  const resultado = await enviarAvisosStockPendientes(createSupabaseServiceRoleClient(), tenantId);

  if (resultado.estado === "error") {
    console.error("[correo-stock] fallo:", resultado.error);
    return NextResponse.json({ ok: false, estado: "error" }, { status: 502 });
  }
  if (resultado.estado === "esperar") {
    return NextResponse.json({ ok: true, estado: "esperar", esperar: resultado.segundos });
  }
  return NextResponse.json({ ok: true, ...resultado });
}
