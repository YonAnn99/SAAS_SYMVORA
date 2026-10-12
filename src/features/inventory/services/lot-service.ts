import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Lote,
  ProductoOption,
} from "../types/inventory.types";
import { diasParaCaducar, type ExistenciaLote } from "../lotes";
import { etiquetaAtributos } from "../atributos-variante";

/** Lote con lo que hay de el en cada sucursal (migracion 116). */
export type LoteConExistencias = Lote & { existencias_lote: ExistenciaLote[] };

/** Alta de un lote desde la pestana Lotes (`registrar_lote`). */
export interface LoteInput {
  producto_id: string;
  variante_id: string | null;
  sucursal_id: string | null;
  numero_lote: string;
  cantidad: number;
  fecha_caducidad: string | null;
  fecha_fabricacion: string | null;
  costo_unitario: number;
  /** `true` = mercancia nueva: tambien suma al inventario. */
  suma_stock: boolean;
}

/** Lo que se edita de un lote ya creado. La cantidad no: sale de los movimientos. */
export interface LoteEdicion {
  numero_lote: string;
  fecha_caducidad: string | null;
  fecha_fabricacion: string | null;
  costo_unitario: number;
}

export interface VarianteLoteOption {
  id: string;
  producto_id: string;
  etiqueta: string;
}

export interface MovimientoLote {
  id: string;
  sucursal_id: string;
  cantidad: number;
  tipo: string;
  venta_id: string | null;
  compra_id: string | null;
  traspaso_id: string | null;
  creado_en: string;
}

export async function fetchLots(tenantId: string): Promise<LoteConExistencias[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("lotes")
    .select("*, existencias_lote(sucursal_id, cantidad)")
    .eq("tenant_id", tenantId)
    .order("fecha_caducidad", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as LoteConExistencias[];
}

/**
 * Los productos a los que se les puede registrar un lote: TODOS los fisicos.
 *
 * Antes solo salian los que tenian activado "Maneja lotes y caducidad", y con
 * ninguno activado el selector abria vacio sin explicar por que. Ese
 * interruptor solo decide si el producto aparece aqui (no cambia nada en el
 * punto de venta), asi que se ofrecen todos y el servidor lo activa al
 * registrar el primer lote. Los servicios quedan fuera: no caducan.
 */
export async function fetchLotProducts(
  tenantId: string
): Promise<ProductoOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, permite_variantes, permite_lotes, costo_compra")
    .eq("tenant_id", tenantId)
    .is("archivado_en", null)
    .eq("es_servicio", false)
    .order("nombre");
  return data ?? [];
}

/** Variantes activas: el lote de un producto con variantes es de UNA variante. */
export async function fetchLotVariants(tenantId: string): Promise<VarianteLoteOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("variantes_producto")
    .select("id, producto_id, talla, color, atributos")
    .eq("tenant_id", tenantId)
    .is("archivado_en", null);
  return (data ?? []).map((v) => ({
    id: v.id as string,
    producto_id: v.producto_id as string,
    etiqueta: etiquetaAtributos(v) || "Variante",
  }));
}

export async function registrarLote(input: LoteInput): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("registrar_lote", {
    p_producto_id: input.producto_id,
    p_variante_id: input.variante_id,
    p_sucursal_id: input.sucursal_id,
    p_numero: input.numero_lote.trim(),
    p_fecha_caducidad: input.fecha_caducidad,
    p_fecha_fabricacion: input.fecha_fabricacion,
    p_costo_unitario: input.costo_unitario,
    p_cantidad: input.cantidad,
    p_suma_stock: input.suma_stock,
  });
  if (error) throw error;
}

export async function updateLot(lotId: string, input: LoteEdicion): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("lotes")
    .update({ ...input, numero_lote: input.numero_lote.trim() })
    .eq("id", lotId);
  if (error) throw error;
}

export async function deleteLot(lotId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("lotes").delete().eq("id", lotId);
  if (error) throw error;
}

/** Kardex del lote: de donde vino y a donde se fue, lo mas reciente primero. */
export async function fetchMovimientosLote(loteId: string): Promise<MovimientoLote[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("movimientos_lote")
    .select("id, sucursal_id, cantidad, tipo, venta_id, compra_id, traspaso_id, creado_en")
    .eq("lote_id", loteId)
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as MovimientoLote[];
}

export function getDaysUntilExpiry(fechaCaducidad: string | null): number | null {
  return diasParaCaducar(fechaCaducidad);
}
