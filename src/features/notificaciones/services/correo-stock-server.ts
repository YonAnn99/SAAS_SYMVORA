import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { sendAvisoStockEmail, type AvisoStockCorreo } from "@/lib/email";

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

/** Máximo un correo de stock por negocio en este lapso; lo demás se junta. */
export const INTERVALO_CORREO_STOCK_SEG = 15 * 60;

export type ResultadoCorreoStock =
  | { estado: "enviado"; avisos: number; destinatarios: number }
  | { estado: "nada" }
  | { estado: "esperar"; segundos: number }
  | { estado: "sin_destinatarios" }
  | { estado: "error"; error: string };

interface AvisoReclamado extends AvisoStockCorreo {
  id: string;
}

/** Dueño y administradores con correo. Ver migración 108 y plan de notificaciones. */
async function destinatarios(supabase: ServiceClient, tenantId: string): Promise<string[]> {
  const { data: miembros } = await supabase
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["SUPER_ADMIN", "ORG_ADMIN"]);

  const correos = await Promise.all(
    (miembros ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id as string);
      return data.user?.email ?? null;
    })
  );
  return [...new Set(correos.filter((c): c is string => Boolean(c)))];
}

/**
 * Manda (si toca) el correo con los avisos de stock pendientes del negocio.
 *
 * `reclamar_avisos_stock` los marca como enviados DE FORMA ATOMICA antes de
 * mandar nada, con un candado por negocio: dos pestañas o la campana y el cron
 * a la vez no duplican el correo. Si Resend falla, `liberar_avisos_stock` los
 * deja pendientes otra vez para el siguiente intento.
 */
export async function enviarAvisosStockPendientes(
  supabase: ServiceClient,
  tenantId: string
): Promise<ResultadoCorreoStock> {
  const { data, error } = await supabase.rpc("reclamar_avisos_stock", {
    p_tenant_id: tenantId,
    p_intervalo_segundos: INTERVALO_CORREO_STOCK_SEG,
  });
  if (error) return { estado: "error", error: error.message };

  const respuesta = (data ?? {}) as { avisos?: AvisoReclamado[]; esperar?: number };
  if (typeof respuesta.esperar === "number") {
    return { estado: "esperar", segundos: respuesta.esperar };
  }
  const avisos = respuesta.avisos ?? [];
  if (avisos.length === 0) return { estado: "nada" };

  const ids = avisos.map((a) => a.id);
  const liberar = async () => {
    await supabase.rpc("liberar_avisos_stock", { p_ids: ids });
  };

  const [para, { data: tenant }] = await Promise.all([
    destinatarios(supabase, tenantId),
    supabase.from("tenants").select("nombre_comercial").eq("id", tenantId).maybeSingle(),
  ]);

  // Sin a quien mandarlo se quedan marcados: reintentar no cambiaria nada.
  if (para.length === 0) return { estado: "sin_destinatarios" };

  const resultado = await sendAvisoStockEmail({
    to: para,
    businessName: (tenant?.nombre_comercial as string | undefined) || "tu negocio",
    avisos: avisos.map((a) => ({
      tipo: a.tipo,
      nombre: a.nombre,
      stock: Number(a.stock),
      minimo: Number(a.minimo),
      unidad: a.unidad,
    })),
  });

  if (!resultado.ok) {
    await liberar();
    return { estado: "error", error: resultado.error ?? "No se pudo enviar" };
  }
  return { estado: "enviado", avisos: avisos.length, destinatarios: para.length };
}
