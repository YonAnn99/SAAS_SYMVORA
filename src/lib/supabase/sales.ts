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

  const { data: venta, error } = await supabase.rpc("complete_sale", {
    p_tenant_id: tenantId,
    p_usuario_id: userId,
    p_cliente_id: clienteId,
    p_metodo_pago: metodoPago,
    p_items: items.map((item) => ({
      productId: item.productId,
      cantidad: item.cantidad,
      descuento: item.descuento,
    })),
    p_notas: notas || null,
  });

  if (error) throw error;
  if (!venta) throw new Error("Error al procesar la venta");

  return venta;
}
