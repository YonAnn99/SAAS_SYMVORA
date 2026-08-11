import { createSupabaseBrowserClient } from "./client";

const IVA_RATE = 0.16;

export interface SaleItem {
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  unidad_medida: string;
}

export interface CompleteSaleParams {
  tenantId: string;
  userId: string;
  clienteId: string | null;
  metodoPago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CREDITO";
  items: SaleItem[];
  notas?: string;
}

export function calculateSaleTotals(items: SaleItem[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad,
    0
  );
  const descuento = items.reduce((sum, item) => sum + item.descuento, 0);
  const subtotalConDescuento = subtotal - descuento;
  const impuesto = subtotalConDescuento * IVA_RATE;
  const total = subtotalConDescuento + impuesto;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    descuento: Math.round(descuento * 100) / 100,
    impuesto: Math.round(impuesto * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export async function completeSale(params: CompleteSaleParams) {
  const supabase = createSupabaseBrowserClient();
  const { tenantId, userId, clienteId, metodoPago, items, notas } = params;

  const totals = calculateSaleTotals(items);

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      tenant_id: tenantId,
      usuario_id: userId,
      cliente_id: clienteId,
      subtotal: totals.subtotal,
      impuesto: totals.impuesto,
      descuento: totals.descuento,
      total: totals.total,
      metodo_pago: metodoPago,
      estado: "COMPLETADA",
      notas: notas || null,
    })
    .select()
    .single();

  if (ventaError) throw ventaError;

  const detalleItems = items.map((item) => ({
    venta_id: venta.id,
    producto_id: item.productId,
    cantidad: item.cantidad,
    precio_unitario: item.precioUnitario,
    subtotal: item.precioUnitario * item.cantidad - item.descuento,
    descuento: item.descuento,
  }));

  const { error: detalleError } = await supabase
    .from("detalle_ventas")
    .insert(detalleItems);

  if (detalleError) throw detalleError;

  for (const item of items) {
    const { data: producto, error: fetchError } = await supabase
      .from("productos")
      .select("stock_actual")
      .eq("id", item.productId)
      .single();

    if (fetchError || !producto) continue;

    const newStock = producto.stock_actual - item.cantidad;
    if (newStock < 0) {
      throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${producto.stock_actual}`);
    }

    await supabase
      .from("productos")
      .update({ stock_actual: newStock })
      .eq("id", item.productId);
  }

  const { data: caja } = await supabase
    .from("cajas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("usuario_id", userId)
    .eq("estado", "ABIERTA")
    .limit(1)
    .single();

  if (caja) {
    await supabase.from("movimientos_caja").insert({
      caja_id: caja.id,
      tipo: "ENTRADA",
      monto: totals.total,
      descripcion: `Venta #${venta.id.slice(0, 8)} - ${metodoPago}`,
    });
  }

  return venta;
}
