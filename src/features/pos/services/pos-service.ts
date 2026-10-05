import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Producto } from "@/lib/types/database";
import type { MetodoPago, SaleTotals, VarianteProducto } from "../types/pos.types";
import {
  conStockDeSucursal,
  conStockDeSucursalVariantes,
  type FilaStockSucursal,
} from "@/features/sucursales/stock";

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

  const llamar = () => supabase.rpc("complete_sale", {
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

  // Dos cobros (o un cobro y una compra) que tocan los mismos productos en el
  // mismo instante pueden chocar: Postgres cancela uno con "deadlock" (40P01)
  // o "serialization failure" (40001). En ambos casos la transaccion se
  // REVIERTE ENTERA —no queda venta a medias—, asi que reintentar es seguro
  // aunque no haya clave de idempotencia. La 107 ya evita el choque entre
  // ventas; esto cubre el caso raro que queda.
  let { data: venta, error } = await llamar();
  for (let intento = 1; error && esChoqueDeConcurrencia(error) && intento <= 2; intento++) {
    await new Promise((r) => setTimeout(r, 100 * intento + Math.random() * 150));
    ({ data: venta, error } = await llamar());
  }

  if (error) throw error;
  if (!venta) throw new Error("Error al procesar la venta");

  return venta;
}

/** Errores de concurrencia de Postgres que revierten la transaccion completa. */
export function esChoqueDeConcurrencia(error: unknown): boolean {
  const codigo = (error as { code?: unknown } | null)?.code;
  return codigo === "40P01" || codigo === "40001";
}

/**
 * Catalogo del punto de venta.
 *
 * CON SUCURSAL (`stockLocal`), el filtro de existencias NO puede hacerse en el
 * servidor: `productos.stock_actual` es el TOTAL del negocio, y un producto con
 * 15 en Principal y 0 en Norte apareceria en el mostrador de Norte para fallar
 * al cobrar con "Disponible: 0". Se trae el catalogo entero y se filtra aqui con
 * las existencias del local de la caja (`vendibleEnPos` en `use-pos-catalog`), que es la misma
 * regla que aplica la base al vender.
 *
 * Sin sucursal se conserva la consulta de siempre.
 *
 * Ya NO filtra por existencias: un producto con variantes puede no tener stock
 * propio (solo es el nombre general) y venderse por sus variantes. El filtro de
 * "vendible" se aplica en `use-pos-catalog` con `vendibleEnPos`, cuando ya se
 * tienen las variantes. Con sucursal, cada producto llega con el stock del
 * local y su `se_vende`.
 */
export async function fetchPosProducts(
  tenantId: string,
  stockLocal: FilaStockSucursal[] | null = null
): Promise<Producto[]> {
  const supabase = createSupabaseBrowserClient();

  if (stockLocal) {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("archivado_en", null)
      .order("nombre");
    if (error) throw error;
    return conStockDeSucursal(data ?? [], stockLocal);
  }

  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("tenant_id", tenantId)
    // Un producto archivado (migracion 102) ya no se vende.
    .is("archivado_en", null)
    // Sin filtro de existencias aqui (ver arriba): los servicios entran en 0 y
    // un producto con variantes entra si alguna tiene stock (`vendibleEnPos`).
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
  tenantId: string,
  stockLocal: FilaStockSucursal[] | null = null
): Promise<VarianteProducto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("variantes_producto")
    // `productos!inner` solo para filtrar: las tallas de un producto archivado
    // (migracion 102) tampoco se venden, ni escaneando su codigo.
    .select(
      "id, producto_id, talla, color, precio_venta, stock_actual, codigo_barras, imagen_url, unidad_medida, stock_minimo, productos!inner(archivado_en)"
    )
    .eq("tenant_id", tenantId)
    .is("productos.archivado_en", null)
    .order("talla");

  if (error) throw error;
  const variantes = (data ?? []) as VarianteProducto[];
  // Cada talla con lo que hay EN EL LOCAL de la caja, no en todo el negocio.
  return stockLocal ? conStockDeSucursalVariantes(variantes, stockLocal) : variantes;
}
