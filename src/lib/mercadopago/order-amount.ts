import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const IVA_RATE = 0.16;

export interface TerminalOrderItem {
  productId: string;
  cantidad: number;
  descuento: number;
}

export interface ComputedTerminalOrder {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  payload: TerminalOrderItem[];
}

export function validateTerminalItems(
  items: TerminalOrderItem[]
): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("La venta debe incluir al menos un producto");
  }
  for (const item of items) {
    if (!item?.productId) throw new Error("Producto inválido");
    if (!(item.cantidad > 0)) throw new Error("Cantidad inválida");
    if (!(item.descuento >= 0)) throw new Error("Descuento inválido");
  }
}

export async function computeTerminalOrderTotal(
  tenantId: string,
  items: TerminalOrderItem[]
): Promise<ComputedTerminalOrder> {
  validateTerminalItems(items);

  const supabase = createSupabaseServiceRoleClient();
  const ids = items.map((item) => item.productId);

  const { data: products, error } = await supabase
    .from("productos")
    .select("id, tenant_id, nombre, precio_venta, stock_actual")
    .in("id", ids);

  if (error) {
    console.error("Error leyendo productos para orden de terminal:", error);
    throw new Error("No se pudieron validar los productos");
  }

  const byId = new Map((products ?? []).map((product) => [product.id, product]));

  let subtotal = 0;
  let descuento = 0;
  const payload: TerminalOrderItem[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || product.tenant_id !== tenantId) {
      throw new Error("Producto inválido para este negocio");
    }
    if (product.stock_actual < item.cantidad) {
      throw new Error(
        `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_actual}`
      );
    }

    const lineSubtotal = product.precio_venta * item.cantidad;
    let lineDescuento = Math.max(0, item.descuento ?? 0);
    if (lineDescuento > lineSubtotal) lineDescuento = lineSubtotal;
    lineDescuento = Math.round(lineDescuento * 100) / 100;

    subtotal += lineSubtotal;
    descuento += lineDescuento;

    payload.push({
      productId: item.productId,
      cantidad: item.cantidad,
      descuento: lineDescuento,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  descuento = Math.round(descuento * 100) / 100;
  const impuesto = Math.round((subtotal - descuento) * IVA_RATE * 100) / 100;
  const total = Math.round((subtotal - descuento + impuesto) * 100) / 100;

  return { subtotal, descuento, impuesto, total, payload };
}