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
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.rpc("log_activity", {
    p_user_id: user.id,
    p_user_email: user.email || "",
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId || null,
    p_entity_name: entityName || null,
    p_details: details ? JSON.stringify(details) : null,
  });
}
