import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AjusteInventario,
  LoteOption,
  MotivoAjuste,
  ProductOption,
  VarianteOption,
} from "../types/inventory.types";

export interface AjusteInput {
  productoId: string;
  cantidadAjuste: number;
  motivo: MotivoAjuste;
  notas: string | null;
  varianteId: string | null;
  loteId: string | null;
}

export async function fetchAdjustments(
  tenantId: string
): Promise<AjusteInventario[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("ajustes_inventario")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("creado_en", { ascending: false });
  return data ?? [];
}

export async function fetchAdjustmentProducts(
  tenantId: string
): Promise<ProductOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

export async function fetchProductVariants(
  tenantId: string,
  productoId: string
): Promise<VarianteOption[]> {
  if (!productoId) return [];
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("variantes_producto")
    .select("id, talla, color, sku")
    .eq("tenant_id", tenantId)
    .eq("producto_id", productoId)
    .order("talla");
  return data ?? [];
}

export async function fetchProductLots(
  tenantId: string,
  productoId: string
): Promise<LoteOption[]> {
  if (!productoId) return [];
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("lotes")
    .select("id, numero_lote, cantidad, fecha_caducidad")
    .eq("tenant_id", tenantId)
    .eq("producto_id", productoId)
    .eq("estado", "ACTIVO")
    .order("fecha_caducidad", { ascending: true });
  return data ?? [];
}

export async function createAdjustment(input: AjusteInput): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("ajustar_inventario", {
    p_producto_id: input.productoId,
    p_cantidad_ajuste: input.cantidadAjuste,
    p_motivo: input.motivo,
    p_notas: input.notas,
    p_variante_id: input.varianteId,
    p_lote_id: input.loteId,
  });
  if (error) throw error;
}

export const motivoLabels: Record<string, string> = {
  MERMA: "Merma",
  CONTEO_FISICO: "Conteo Físico",
  DEVOLUCION: "Devolución",
  DAÑO: "Daño",
  OTRO: "Otro",
};