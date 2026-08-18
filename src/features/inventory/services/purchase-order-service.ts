import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  DetalleOrdenCompra,
  OrdenCompra,
  ProductOption,
} from "../types/inventory.types";

export const orderEstadoLabels: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  RECIBIDA_PARCIAL: "Recibida Parcial",
  RECIBIDA_TOTAL: "Recibida Total",
  CANCELADA: "Cancelada",
};

export const orderEstadoColors: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-800",
  ENVIADA: "bg-blue-100 text-blue-800",
  RECIBIDA_PARCIAL: "bg-yellow-100 text-yellow-800",
  RECIBIDA_TOTAL: "bg-green-100 text-green-800",
  CANCELADA: "bg-red-100 text-red-800",
};

export interface OrderDetailItem {
  producto_id: string;
  cantidad_solicitada: number;
  costo_unitario: number;
  subtotal: number;
}

export async function fetchOrders(tenantId: string): Promise<OrdenCompra[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("ordenes_compra")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("creado_en", { ascending: false });
  return data ?? [];
}

export async function fetchOrderSuppliers(
  tenantId: string
): Promise<ProductOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

export async function fetchOrderProducts(
  tenantId: string
): Promise<{ id: string; nombre: string; costo_compra: number }[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, costo_compra")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

export async function fetchOrderDetails(
  ordenId: string
): Promise<DetalleOrdenCompra[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("detalle_orden_compra")
    .select("*")
    .eq("orden_compra_id", ordenId);
  return data ?? [];
}

export async function createOrder(
  tenantId: string,
  userId: string,
  input: {
    proveedor_id: string;
    numero_orden: string;
    subtotal: number;
    impuesto: number;
    total: number;
    notas: string | null;
  },
  details: OrderDetailItem[]
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: newOrder, error } = await supabase
    .from("ordenes_compra")
    .insert({
      tenant_id: tenantId,
      usuario_id: userId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  if (!newOrder) throw new Error("Error al crear la orden");

  const { error: detailsError } = await supabase
    .from("detalle_orden_compra")
    .insert(
      details.map((d) => ({ orden_compra_id: newOrder.id, ...d }))
    );
  if (detailsError) throw detailsError;
}

export async function updateOrder(
  orderId: string,
  input: {
    proveedor_id: string;
    numero_orden: string;
    subtotal: number;
    impuesto: number;
    total: number;
    notas: string | null;
  },
  details: OrderDetailItem[]
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("ordenes_compra")
    .update(input)
    .eq("id", orderId);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("detalle_orden_compra")
    .delete()
    .eq("orden_compra_id", orderId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("detalle_orden_compra")
    .insert(details.map((d) => ({ orden_compra_id: orderId, ...d })));
  if (insertError) throw insertError;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrdenCompra["estado"]
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const updates: Record<string, unknown> = { estado: newStatus };
  if (newStatus === "ENVIADA" || newStatus === "RECIBIDA_TOTAL") {
    updates.fecha_recepcion = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ordenes_compra")
    .update(updates)
    .eq("id", orderId);
  if (error) throw error;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error: deleteDetailsError } = await supabase
    .from("detalle_orden_compra")
    .delete()
    .eq("orden_compra_id", orderId);
  if (deleteDetailsError) throw deleteDetailsError;

  const { error } = await supabase
    .from("ordenes_compra")
    .delete()
    .eq("id", orderId);
  if (error) throw error;
}