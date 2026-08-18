import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ProductoOption,
  VarianteProducto,
} from "../types/inventory.types";

export interface VarianteInput {
  producto_id: string;
  sku: string | null;
  codigo_barras: string | null;
  talla: string | null;
  color: string | null;
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
}

export async function fetchVariants(tenantId: string): Promise<VarianteProducto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("variantes_producto")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("creado_en", { ascending: false });
  return data ?? [];
}

export async function fetchVariantProducts(
  tenantId: string
): Promise<ProductoOption[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("id, nombre, permite_variantes, permite_lotes")
    .eq("tenant_id", tenantId)
    .eq("permite_variantes", true)
    .order("nombre");
  return data ?? [];
}

export async function createVariant(
  tenantId: string,
  input: VarianteInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("variantes_producto")
    .insert({ tenant_id: tenantId, ...input });
  if (error) throw error;
}

export async function updateVariant(
  variantId: string,
  input: VarianteInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("variantes_producto")
    .update(input)
    .eq("id", variantId);
  if (error) throw error;
}

export async function deleteVariant(variantId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("variantes_producto")
    .delete()
    .eq("id", variantId);
  if (error) throw error;
}