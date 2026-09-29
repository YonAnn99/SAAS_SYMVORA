import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Lote,
  ProductoOption,
} from "../types/inventory.types";

export interface LoteInput {
  producto_id: string;
  numero_lote: string;
  cantidad: number;
  fecha_caducidad: string | null;
  fecha_fabricacion: string | null;
  costo_unitario: number;
}

export async function fetchLots(tenantId: string): Promise<Lote[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("lotes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("fecha_caducidad", { ascending: true });
  return data ?? [];
}

/**
 * Los productos a los que se les puede registrar un lote: TODOS los fisicos.
 *
 * Antes solo salian los que tenian activado "Maneja lotes y caducidad", y con
 * ninguno activado el selector abria vacio sin explicar por que. Ese
 * interruptor solo decide si el producto aparece aqui (no cambia nada en el
 * punto de venta), asi que se ofrecen todos y `createLot` lo activa al
 * registrar el primer lote. Los servicios quedan fuera: no caducan.
 */
export async function fetchLotProducts(
  tenantId: string
): Promise<ProductoOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, permite_variantes, permite_lotes")
    .eq("tenant_id", tenantId)
    .eq("es_servicio", false)
    .order("nombre");
  return data ?? [];
}

export async function createLot(
  tenantId: string,
  input: LoteInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("lotes")
    .insert({ tenant_id: tenantId, ...input });
  if (error) throw error;

  // Con su primer lote el producto pasa a "Maneja lotes y caducidad", para que
  // su interruptor en el catalogo diga la verdad. El filtro hace que sea un
  // no-op si ya lo tenia.
  const { error: errorProducto } = await supabase
    .from("productos")
    .update({ permite_lotes: true })
    .eq("id", input.producto_id)
    .eq("tenant_id", tenantId)
    .eq("permite_lotes", false);
  if (errorProducto) throw errorProducto;
}

export async function updateLot(lotId: string, input: LoteInput): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("lotes").update(input).eq("id", lotId);
  if (error) throw error;
}

export async function deleteLot(lotId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("lotes").delete().eq("id", lotId);
  if (error) throw error;
}

export function getDaysUntilExpiry(fechaCaducidad: string | null): number | null {
  if (!fechaCaducidad) return null;
  const today = new Date();
  const expiry = new Date(fechaCaducidad);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}