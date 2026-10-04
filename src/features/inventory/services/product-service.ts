import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cropToSquareWebP } from "@/lib/image";
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
  permite_lotes: boolean;
  permite_variantes: boolean;
  imagen_url: string | null;
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
    // Los archivados (migracion 102) no son parte del catalogo; se ven en
    // "Archivados" (`fetchArchivedProducts`).
    .is("archivado_en", null)
    .order("nombre");
  return data ?? [];
}

/**
 * Devuelve el id nuevo: con varias sucursales, las existencias iniciales se
 * cargan DESPUES en el local elegido (`establecerStockSucursal`), y para eso
 * hace falta saber que producto se acaba de crear.
 */
export async function createProduct(
  tenantId: string,
  input: ProductInput
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("productos")
    .insert({
      tenant_id: tenantId,
      ...input,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * `Partial` a proposito: el dialogo manda el producto entero, la edicion
 * express de la tabla manda un solo campo. PostgREST acepta ambos.
 */
export async function updateProduct(
  productId: string,
  input: Partial<ProductInput>
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("productos")
    // `productos` NO tiene trigger BEFORE UPDATE que toque `actualizado_en`
    // (solo lo escriben algunos RPC). Sin esta linea, el orden "Últimos
    // modificados" de la tabla no reflejaba NINGUNA edicion hecha desde la
    // interfaz: la columna se quedaba en la fecha de creacion.
    .update({ ...input, actualizado_en: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

export async function deleteProduct(productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("productos").delete().eq("id", productId);
  if (error) throw error;
}

/**
 * El producto no se pudo borrar porque tiene historial: ventas, compras,
 * ajustes, ordenes o traspasos lo referencian (llaves foraneas NO ACTION, a
 * proposito: borrarlo romperia reportes y cortes). En ese caso se ofrece
 * archivarlo.
 */
export function esErrorDeHistorial(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23503"
  );
}

/**
 * Archiva un producto con historial: sale del catalogo, del POS y de los
 * selectores, y sus ventas y reportes no cambian (migracion 102).
 */
export async function archiveProduct(productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("productos")
    .update({ archivado_en: ahora, actualizado_en: ahora })
    .eq("id", productId);
  if (error) throw error;
}

/** Mensaje al restaurar un producto cuyo codigo ya usa otro activo. */
export const CODIGO_OCUPADO_AL_RESTAURAR =
  "Ya hay un producto activo con ese código de barras o SKU. Cámbiaselo a uno de los dos para restaurarlo.";

export async function restoreProduct(productId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("productos")
    .update({ archivado_en: null, actualizado_en: new Date().toISOString() })
    .eq("id", productId);
  if (error) {
    // Al archivarlo, su codigo quedo libre (indices unicos solo sobre activos)
    // y pudo darse de alta otro producto con el.
    if ((error as { code?: string }).code === "23505") {
      throw new Error(CODIGO_OCUPADO_AL_RESTAURAR);
    }
    throw error;
  }
}

export async function fetchArchivedProducts(tenantId: string): Promise<Producto[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("tenant_id", tenantId)
    .not("archivado_en", "is", null)
    .order("archivado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
/**
 * Convierte la imagen elegida y la sube, devolviendo su URL publica.
 *
 * POR QUE ESTA AQUI Y NO EN EL DIALOGO. Vivia incrustada dentro del
 * `handleSubmit` de `product-dialog.tsx`: convertir, subir a Storage y armar la
 * URL, todo dentro del manejador del formulario. Sacarla deja UN SOLO punto por
 * el que una imagen se convierte en URL, que es donde entrara el quitafondos
 * (PhotoRoom) cuando se decida — llamando a una ruta de servidor, porque esa
 * llave no puede pisar el navegador. Sin este paso habria que desmontar el
 * `handleSubmit` en ese momento.
 *
 * Lo que hace es exactamente lo de antes: recorte cuadrado a 800x800 en webp,
 * bucket `product-images`, ruta `{tenant_id}/{uuid}.webp`.
 *
 * ⚠️ La imagen anterior NO se borra al reemplazarla: cada subida usa un UUID
 * nuevo y queda huerfana en Storage. Es un fallo preexistente, anotado aparte.
 */
export async function subirImagenProducto(
  file: File,
  tenantId: string
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  // La conversion es tambien lo que hace que el limite del bucket (2 MB) no se
  // pueda incumplir: entra una foto de 6 MB del celular y sale un webp de ~150 KB.
  const webpFile = await cropToSquareWebP(file);
  const filePath = `${tenantId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, webpFile, { contentType: "image/webp" });

  if (error) throw error;

  const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
  return data.publicUrl;
}
