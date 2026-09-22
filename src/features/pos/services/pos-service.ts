import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Producto } from "@/lib/types/database";
import type { MetodoPago, SaleTotals, VarianteProducto } from "../types/pos.types";

const IVA_RATE = 0.16;

export interface SaleItem {
  productId: string;
  varianteId?: string | null;
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
  metodoPago: MetodoPago;
  items: SaleItem[];
  includeIva: boolean;
  notas?: string;
  montoRecibido?: number | null;
  /**
   * Parametros opcionales de la firma del RPC (migración 051). Nacieron para
   * que la cola de ventas offline pudiera subir una venta diferida con su
   * fecha, su caja y su clave de deduplicacion. La cola se retiró con el modo
   * sin conexión (2026-09-20), pero se mantienen aquí porque la FIRMA del RPC
   * no cambia y `idempotencyKey` sigue siendo la vía para que un reintento no
   * duplique un cobro.
   */
  idempotencyKey?: string | null;
  /** Fecha real de la venta. Se omite y el servidor pone la de ahora. */
  fechaVenta?: string | null;
  /** Caja abierta cuando se vendió. */
  cajaId?: string | null;
  /** Total del ticket entregado al cliente, para detectar cambios de precio. */
  totalCobrado?: number | null;
  /**
   * Lista de precios con la que se cobra. Se manda el ID, jamas el precio:
   * el servidor lo relee de `precios_lista` (migracion 068).
   */
  listaPrecioId?: string | null;
}

export function calculateSaleTotals(items: SaleItem[], includeIva = true): SaleTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.precioUnitario * item.cantidad,
    0
  );
  const descuento = items.reduce((sum, item) => sum + item.descuento, 0);
  const subtotalConDescuento = subtotal - descuento;
  const impuesto = includeIva ? subtotalConDescuento * IVA_RATE : 0;
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
  const {
    tenantId,
    userId,
    clienteId,
    metodoPago,
    items,
    includeIva,
    notas,
    montoRecibido,
    idempotencyKey,
    fechaVenta,
    cajaId,
    totalCobrado,
    listaPrecioId,
  } = params;

  const { data: venta, error } = await supabase.rpc("complete_sale", {
    p_tenant_id: tenantId,
    p_usuario_id: userId,
    p_cliente_id: clienteId,
    p_metodo_pago: metodoPago,
    // Solo se manda producto/cantidad/descuento: el precio lo recalcula el
    // servidor desde `productos.precio_venta`. No mandar precio desde aquí
    // (bug #5: sobreventa y precios inventados).
    p_items: items.map((item) => ({
      productId: item.productId,
      // La variante va dentro del JSON de items, así que la FIRMA del RPC no
      // cambia. El servidor valida que pertenezca al producto y al negocio, y
      // usa SU precio y SU stock.
      varianteId: item.varianteId ?? null,
      cantidad: item.cantidad,
      descuento: item.descuento,
    })),
    p_include_iva: includeIva,
    p_notas: notas || null,
    p_monto_recibido: montoRecibido ?? null,
    p_idempotency_key: idempotencyKey ?? null,
    p_fecha_venta: fechaVenta ?? null,
    p_caja_id: cajaId ?? null,
    p_total_cobrado: totalCobrado ?? null,
    // Ya no hay otro origen posible: el modo sin conexión se retiró.
    p_origen: "online",
    p_lista_precio_id: listaPrecioId ?? null,
  });

  if (error) throw error;
  if (!venta) throw new Error("Error al procesar la venta");

  return venta;
}

export async function fetchPosProducts(tenantId: string): Promise<Producto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("tenant_id", tenantId)
    // LOS SERVICIOS ENTRAN AUNQUE NO TENGAN EXISTENCIAS. Antes esto era un
    // `.gt("stock_actual", 0)` a secas, y como un servicio vive siempre en 0
    // (una asesoria, un envio a domicilio) nunca llegaba al mostrador: quedaba
    // dado de alta en el catalogo y era imposible cobrarlo.
    //
    // Mismo criterio que `fetchPosVariants` justo debajo, que tampoco filtra
    // por stock a proposito.
    .or("stock_actual.gt.0,es_servicio.eq.true")
    .order("nombre");

  if (error) throw error;
  return data ?? [];
}

/**
 * Variantes del tenant para el POS.
 *
 * NO se filtra por stock > 0 (a diferencia de los productos): el diálogo
 * necesita poder mostrar una talla agotada como tal en vez de ocultarla, que
 * es lo que el cajero espera ver cuando el cliente pregunta por ella.
 */
export async function fetchPosVariants(
  tenantId: string
): Promise<VarianteProducto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("variantes_producto")
    .select("id, producto_id, talla, color, precio_venta, stock_actual")
    .eq("tenant_id", tenantId)
    .order("talla");

  if (error) throw error;
  return (data ?? []) as VarianteProducto[];
}
