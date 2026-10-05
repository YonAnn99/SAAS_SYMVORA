import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * `REIMPRIMIR` se anadio con el historial de ventas (migracion 072).
 *
 * No se reutilizo `CREATE` a proposito: la Bitacora habria dicho que alguien
 * creo una venta cuando solo volvio a sacar su ticket, y es el unico sitio
 * al que se acude cuando algo huele mal.
 */
// DESCUENTO: descuento manual en el POS (migracion 094). La base solo acepta
// las acciones de `activity_logs_action_check`: una nueva va primero alli.
type ActivityAction = "CREATE" | "UPDATE" | "DELETE" | "REIMPRIMIR" | "DESCUENTO";
type ActivityEntity = "producto" | "venta" | "compra" | "cliente" | "proveedor" | "usuario" | "caja" | "config" | "orden_compra" | "movimiento_caja" | "traspaso";

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

    // Sesion local, sin ida a la red: desde la migracion 106 la base exige que
    // `p_user_id` sea el de la sesion (`auth.uid()`) y toma el correo de
    // `auth.users`, asi que no hace falta verificarlo aqui con `getUser()`.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

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
