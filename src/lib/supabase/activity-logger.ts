import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ActivityAction = "CREATE" | "UPDATE" | "DELETE";
type ActivityEntity = "producto" | "venta" | "compra" | "cliente" | "proveedor" | "usuario" | "caja" | "config" | "orden_compra" | "movimiento_caja";

interface LogActivityParams {
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  action,
  entity,
  entityId,
  entityName,
  details,
}: LogActivityParams) {
  try {
    const supabase = createSupabaseBrowserClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.rpc("log_activity", {
      p_user_id: user.id,
      p_user_email: user.email || "",
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId || null,
      p_entity_name: entityName || null,
      // El objeto TAL CUAL, sin `JSON.stringify`. `log_activity` recibe jsonb y
      // supabase-js ya serializa el cuerpo del RPC: al mandarle una cadena ya
      // serializada, Postgres la guardaba como un escalar string de JSON
      // (`"{\"fondo_inicial\":300}"`) en vez de un objeto, y la Bitácora la
      // pintaba carácter a carácter (`0: { 1: " 2: f …`).
      p_details: details ?? null,
    });

    if (error) {
      console.error("[activity-logger] RPC error:", error);
    }
  } catch (err) {
    console.error("[activity-logger] unexpected error:", err);
  }
}
