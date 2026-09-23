import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Proveedor,
  PurchaseWithRelations,
} from "../types/inventory.types";
import type { RenglonCompraRpc } from "../compra-directa";

export const purchaseStatusColors: Record<string, string> = {
  PENDIENTE: "bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]",
  RECIBIDA: "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]",
  CANCELADA: "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]",
};

export interface PurchaseInput {
  proveedorId: string;
  numeroFactura: string;
  /** Renglones de la compra. Sin ellos no hay compra: ver `createPurchase`. */
  items: RenglonCompraRpc[];
  incluyeIva: boolean;
  notas?: string | null;
  /** El local que RECIBE la mercancia. Sin ella, el de por defecto (082). */
  sucursalId?: string | null;
}

export interface SupplierInput {
  nombre: string;
  email: string;
  phone: string;
}

export async function fetchPurchases(tenantId: string): Promise<PurchaseWithRelations[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("compras")
    .select(`
      *,
      proveedor:proveedores!proveedor_id(nombre),
      renglones:detalle_compras(
        id, cantidad, costo_unitario, subtotal, variante_id,
        producto:productos!producto_id(nombre)
      )
    `)
    .eq("tenant_id", tenantId)
    .order("fecha_compra", { ascending: false });
  return data ?? [];
}

export async function fetchSuppliers(tenantId: string): Promise<Proveedor[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("proveedores")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

/**
 * Registra una compra directa: la que se hace sin orden previa.
 *
 * Pasa por el RPC `registrar_compra_directa` (migracion 074) y NO por un INSERT
 * suelto, por dos razones que no son de estilo:
 *
 *  - La compra tiene que SUMAR STOCK, escribir sus renglones y fijar el ultimo
 *    costo en la misma transaccion. Hacerlo en varias llamadas desde el
 *    navegador dejaria compras a medias en cuanto una fallara.
 *  - El `subtotal`, el `impuesto` y el `total` los calcula el servidor a partir
 *    de los renglones. Mandarlos desde aqui permitiria que la pantalla dijera
 *    una cosa y la base guardara otra.
 *
 * El `usuario_id` tampoco viaja: el RPC lo toma de `auth.uid()`.
 */
export async function createPurchase(
  tenantId: string,
  input: PurchaseInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("registrar_compra_directa", {
    p_tenant_id: tenantId,
    p_proveedor_id: input.proveedorId,
    p_items: input.items,
    p_numero_factura: input.numeroFactura || null,
    p_incluye_iva: input.incluyeIva,
    p_notas: input.notas ?? null,
    p_sucursal_id: input.sucursalId ?? null,
  });
  if (error) throw error;
}

/**
 * Cancela una compra devolviendo al inventario lo que sumo.
 *
 * Sustituye al borrado para cualquier compra con renglones. El borrado duro no
 * revertia el stock, asi que equivocarse en una cantidad dejaba existencias
 * fantasma que solo se podian arreglar con un ajuste manual.
 *
 * NO revierte el costo: `costo_compra` es "ultimo costo" y no se guarda el
 * anterior en ningun sitio. La pantalla lo advierte.
 */
export async function cancelPurchase(purchaseId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("cancelar_compra", {
    p_compra_id: purchaseId,
  });
  if (error) throw error;
}

export async function createSupplier(
  tenantId: string,
  input: SupplierInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("proveedores").insert({
    tenant_id: tenantId,
    nombre: input.nombre,
    email: input.email || null,
    telefono: input.phone || null,
  });
  if (error) throw error;
}

export async function updateSupplier(
  supplierId: string,
  input: SupplierInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("proveedores")
    // ⚠️ `contact_name` NO va en el patch, y es a proposito. La columna sigue
    // existiendo con datos de proveedores antiguos; si se mandara desde un
    // formulario que ya no lo captura, el primer "Guardar cambios" lo borraria.
    .update({
      nombre: input.nombre,
      email: input.email || null,
      telefono: input.phone || null,
    })
    .eq("id", supplierId);
  if (error) throw error;
}

/**
 * Corrige los datos de cabecera de una compra.
 *
 * Ya NO toca el `total`: desde la 074 los importes se derivan de los renglones
 * y los calcula el servidor. Reescribirlos aqui volveria a permitir que la
 * cabecera y su desglose dijeran cosas distintas.
 */
export async function updatePurchase(
  purchaseId: string,
  input: PurchaseInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("compras")
    .update({
      proveedor_id: input.proveedorId,
      numero_factura: input.numeroFactura || null,
    })
    .eq("id", purchaseId);
  if (error) throw error;
}

export async function updatePurchaseStatus(
  purchaseId: string,
  estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA"
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const updates: { estado: string; fecha_recepcion?: string } = { estado };
  if (estado === "RECIBIDA") {
    updates.fecha_recepcion = new Date().toISOString();
  }
  const { error } = await supabase
    .from("compras")
    .update(updates)
    .eq("id", purchaseId);
  if (error) throw error;
}

/**
 * Borra una compra, SOLO si no movio inventario.
 *
 * Queda para las cabeceras heredadas: las que la pantalla vieja creaba sin
 * renglones y que por tanto no sumaron stock. Cualquier compra con renglones se
 * CANCELA (`cancelPurchase`), porque borrarla se llevaria la fila y dejaria el
 * stock que acredito, sin rastro de donde salio.
 */
export async function deletePurchase(purchaseId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { count, error: errorConteo } = await supabase
    .from("detalle_compras")
    .select("id", { count: "exact", head: true })
    .eq("compra_id", purchaseId);
  if (errorConteo) throw errorConteo;

  if ((count ?? 0) > 0) {
    throw new Error(
      "Esta compra movió inventario: cancélala en vez de borrarla, para que el stock regrese."
    );
  }

  const { error } = await supabase.from("compras").delete().eq("id", purchaseId);
  if (error) throw error;
}