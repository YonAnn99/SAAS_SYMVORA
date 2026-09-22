import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Las sucursales de un negocio.
 *
 * QUE ES UNA SUCURSAL AQUI, Y QUE NO. Es la DIMENSION por la que se agrupan las
 * cifras: cada venta lleva la suya y el panel puede filtrar por ella. Lo que NO
 * es —todavia— es un almacen: **el stock sigue siendo del negocio, no del
 * local**. Si vendes el mismo producto en dos sucursales, las unidades son un
 * unico numero compartido. Separarlas es la fase grande.
 *
 * DE DONDE SACA UNA VENTA SU SUCURSAL: de la caja. Un mostrador esta en un local
 * concreto, asi que la sucursal se elige una vez al abrir caja y todas las
 * ventas del turno la heredan, dentro de `_crear_venta_desde_items`. No se
 * manda desde el navegador, por el mismo motivo que no se manda el precio
 * (bug #5): lo que decide el dinero lo decide el servidor.
 */

export interface Sucursal {
  id: string;
  tenant_id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  creado_en: string;
}

/**
 * Todas las sucursales del negocio, incluidas las inactivas.
 *
 * Las inactivas hacen falta para LEER el pasado: una venta de hace tres meses
 * puede apuntar a un local ya cerrado, y en el panel tiene que seguir teniendo
 * nombre en vez de aparecer como un identificador suelto.
 */
export async function fetchSucursales(tenantId: string): Promise<Sucursal[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sucursales")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as Sucursal[];
}

export async function createSucursal(
  tenantId: string,
  nombre: string,
  direccion: string | null
): Promise<Sucursal> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sucursales")
    .insert({ tenant_id: tenantId, nombre: nombre.trim(), direccion })
    .select()
    .single();
  if (error) throw error;
  return data as Sucursal;
}

export async function updateSucursal(
  id: string,
  cambios: { nombre?: string; direccion?: string | null; activa?: boolean }
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("sucursales")
    .update(cambios)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Desactiva la sucursal en vez de borrarla.
 *
 * Borrarla de verdad falla a proposito si tiene ventas o cajas detras
 * (`ON DELETE RESTRICT` en la migracion 076): el historico no se reescribe
 * porque un local cierre. Desactivar la saca del desplegable de apertura de
 * caja y la deja en paz en los informes.
 */
export async function desactivarSucursal(id: string): Promise<void> {
  return updateSucursal(id, { activa: false });
}
