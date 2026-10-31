import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

/** Un insumo ajustado en el POS: TOTAL de la linea, como en el cobro directo. */
export interface TerminalOrderInsumo {
  productId: string;
  varianteId: string | null;
  cantidad: number;
}

export interface TerminalOrderItem {
  productId: string;
  /** Producto con variantes: la variante es lo que se vende (su precio y su stock). */
  varianteId?: string | null;
  cantidad: number;
  descuento: number;
  /** Solo si se ajustaron en el POS; sin la clave, el servidor usa la receta. */
  insumos?: TerminalOrderInsumo[];
}

export interface ComputedTerminalOrder {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  /** Lo que se guarda en `pagos_terminal.payload_items` y con lo que se crea la venta. */
  payload: TerminalOrderItem[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (item.varianteId != null && !UUID.test(item.varianteId)) {
      throw new Error("Variante inválida");
    }
    if (item.insumos !== undefined) {
      if (!Array.isArray(item.insumos)) throw new Error("Insumos inválidos");
      for (const i of item.insumos) {
        if (!i?.productId || !(i.cantidad >= 0)) throw new Error("Insumos inválidos");
      }
    }
  }
}

/** Solo las claves que entiende `_crear_venta_desde_items`, nada de lo que mande el navegador de mas. */
export function normalizarItemsTerminal(items: TerminalOrderItem[]): TerminalOrderItem[] {
  return items.map((item) => ({
    productId: item.productId,
    varianteId: item.varianteId ?? null,
    cantidad: item.cantidad,
    descuento: item.descuento,
    ...(item.insumos
      ? {
          insumos: item.insumos.map((i) => ({
            productId: i.productId,
            varianteId: i.varianteId ?? null,
            cantidad: i.cantidad,
          })),
        }
      : {}),
  }));
}

/**
 * El monto que se le manda a la terminal. NO se calcula aqui: lo calcula
 * `cotizar_venta_terminal` (migracion 127), que ensaya la venta con
 * `_crear_venta_desde_items` —la misma funcion que la registra al confirmarse
 * el pago— y la deshace. Asi variantes, listas de precios, stock por sucursal,
 * lotes caducados, insumos, tope del descuento e IVA son exactamente los del
 * cobro directo, y un error (stock insuficiente…) llega con el mismo mensaje.
 *
 * Antes este calculo vivia aqui en TypeScript y se habia quedado atras: no
 * conocia las variantes ("Stock insuficiente" con cualquier variante) y cobraba
 * el IVA siempre, aunque el carrito no lo incluyera.
 */
export async function computeTerminalOrderTotal(params: {
  tenantId: string;
  usuarioId: string;
  clienteId: string | null;
  items: TerminalOrderItem[];
  includeIva: boolean;
  /** Lista de precios con la que se cobra: el servidor relee sus precios. */
  listaPrecioId?: string | null;
  /** `null` = sin tope (dueño o permiso `sales.discount_unlimited`). */
  topeDescuentoPct: number | null;
}): Promise<ComputedTerminalOrder> {
  validateTerminalItems(params.items);
  const payload = normalizarItemsTerminal(params.items);

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("cotizar_venta_terminal", {
    p_tenant_id: params.tenantId,
    p_usuario_id: params.usuarioId,
    p_cliente_id: params.clienteId,
    p_items: payload,
    p_include_iva: params.includeIva,
    p_lista_precio_id: params.listaPrecioId ?? null,
    p_tope_descuento_pct: params.topeDescuentoPct,
  });

  if (error || !data) {
    // Los mensajes de la base ya estan en español ("Stock insuficiente para…").
    throw new Error(error?.message || "No se pudo calcular el monto a cobrar");
  }

  const importes = data as Record<string, number | string>;
  const num = (v: number | string | undefined) => Math.round(Number(v ?? 0) * 100) / 100;
  return {
    subtotal: num(importes.subtotal),
    descuento: num(importes.descuento),
    impuesto: num(importes.impuesto),
    total: num(importes.total),
    payload,
  };
}
