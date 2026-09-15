import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Favoritos del catalogo, privados de cada usuario.
 *
 * El `user_id` NO se manda desde aqui en ningun momento: la columna lo pone
 * con `DEFAULT auth.uid()` (migracion 064) y las politicas RLS exigen que
 * coincida. Asi el cliente no puede escribir en los favoritos de otro ni leer
 * los ajenos, aunque alguien manipule la peticion.
 */

/** Los ids que el usuario actual tiene marcados. */
export async function fetchFavoritos(tenantId: string): Promise<Set<string>> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("productos_favoritos")
    .select("producto_id")
    .eq("tenant_id", tenantId);

  // Se devuelve un conjunto vacio en vez de propagar: si la tabla aun no esta
  // creada (migracion sin aplicar) el catalogo debe seguir funcionando; lo
  // unico que pasa es que nadie tiene favoritos.
  if (error) return new Set();

  return new Set((data ?? []).map((f) => f.producto_id as string));
}

export async function toggleFavorito(
  tenantId: string,
  productoId: string,
  activar: boolean
): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  if (activar) {
    const { error } = await supabase
      .from("productos_favoritos")
      .insert({ tenant_id: tenantId, producto_id: productoId });
    if (error) throw error;
    return;
  }

  // Sin filtrar por `user_id`: la politica de DELETE ya lo acota a los del
  // propio usuario, y filtrarlo aqui obligaria a pasear el id por el cliente.
  const { error } = await supabase
    .from("productos_favoritos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("producto_id", productoId);
  if (error) throw error;
}
