import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  construirMapaLista,
  precioConLista,
} from "@/features/pos/price-list-pos";

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
  items: TerminalOrderItem[],
  /**
   * Lista de precios con la que se cobra. El monto que se le manda al
   * datafono TIENE que salir de aqui: si no, la terminal cobraria el precio
   * base y la venta se registraria con el de lista.
   */
  listaPrecioId?: string | null
): Promise<ComputedTerminalOrder> {
  validateTerminalItems(items);

  const supabase = createSupabaseServiceRoleClient();
  const ids = items.map((item) => item.productId);

  // Se lee del servidor, nunca del navegador: el cliente manda el ID de la
  // lista y el precio se relee aqui, igual que hace `complete_sale`.
  let mapaLista = null;
  if (listaPrecioId) {
    const { data: lista, error: listaError } = await supabase
      .from("listas_precios")
      .select("id")
      .eq("id", listaPrecioId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (listaError || !lista) {
      throw new Error("Lista de precios inválida para este negocio");
    }

    const { data: renglones, error: renglonesError } = await supabase
      .from("precios_lista")
      .select("producto_id, variante_id, precio")
      .eq("lista_id", listaPrecioId);

    if (renglonesError) {
      throw new Error("No se pudieron leer los precios de la lista");
    }

    mapaLista = construirMapaLista(
      (renglones ?? []).map((r) => ({
        producto_id: r.producto_id as string,
        variante_id: r.variante_id as string | null,
        precio: r.precio === null ? null : Number(r.precio),
      }))
    );
  }

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

    // Nota: este camino no distingue variantes (limitacion previa a las
    // listas), asi que se consulta la fila del producto suelto.
    const precio = precioConLista(
      product.precio_venta,
      mapaLista,
      product.id,
      null
    );
    const lineSubtotal = precio * item.cantidad;
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