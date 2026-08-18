import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Producto } from "../types/inventory.types";

export interface ProductInput {
  nombre: string;
  descripcion: string | null;
  codigo_barras: string | null;
  sku: string | null;
  unidad_medida: Producto["unidad_medida"];
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
  stock_minimo: number;
  es_servicio: boolean;
  categoria: string | null;
}

export async function fetchProducts(tenantId: string): Promise<Producto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

export async function createProduct(
  tenantId: string,
  input: ProductInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("productos").insert({
    tenant_id: tenantId,
    ...input,
  });
  if (error) throw error;
}

export async function updateProduct(
  productId: string,
  input: ProductInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("productos")
    .update(input)
    .eq("id", productId);
  if (error) throw error;
}

export async function deleteProduct(productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("productos").delete().eq("id", productId);
  if (error) throw error;
}