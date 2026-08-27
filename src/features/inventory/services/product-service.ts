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

export async function generateNextBarcode(tenantId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("codigo_barras")
    .eq("tenant_id", tenantId)
    .not("codigo_barras", "is", null)
    .like("codigo_barras", "750%")
    .order("codigo_barras", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0 && data[0].codigo_barras) {
    const lastCode = data[0].codigo_barras;
    const lastNumber = parseInt(lastCode.slice(-5), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `750${nextNumber.toString().padStart(10, "0")}`;
}

export async function generateNextSku(tenantId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("productos")
    .select("sku")
    .eq("tenant_id", tenantId)
    .not("sku", "is", null)
    .like("sku", "PROD-%")
    .order("sku", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0 && data[0].sku) {
    const lastSku = data[0].sku;
    const lastNumber = parseInt(lastSku.split("-")[1], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `PROD-${nextNumber.toString().padStart(4, "0")}`;
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