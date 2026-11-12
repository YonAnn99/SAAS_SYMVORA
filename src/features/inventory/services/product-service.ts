import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cropToSquareWebP } from "@/lib/image";
import { elegirCodigosLibres } from "@/lib/codigo-barras";
import type { Producto } from "../types/inventory.types";

export interface ProductInput {
  nombre: string;
  descripcion: string | null;
  codigo_barras: string | null;
  sku: string | null;
  unidad_medida: Producto["unidad_medida"];
  /** Contenido del envase (migracion 114). Opcional: la importacion no lo manda. */
  contenido_cantidad?: number | null;
  contenido_unidad?: Producto["unidad_medida"] | null;
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

/**
 * De una tanda de codigos, los que ya usa un producto o una variante activos
 * del negocio (los archivados no reservan su codigo, migraciones 102 y 110).
 */
async function codigosEnUso(tenantId: string, codigos: string[]): Promise<Set<string>> {
  const supabase = createSupabaseBrowserClient();
  const [productos, variantes] = await Promise.all([
    supabase
      .from("productos")
      .select("codigo_barras")
      .eq("tenant_id", tenantId)
      .is("archivado_en", null)
      .in("codigo_barras", codigos),
    supabase
      .from("variantes_producto")
      .select("codigo_barras")
      .eq("tenant_id", tenantId)
      .is("archivado_en", null)
      .in("codigo_barras", codigos),
  ]);
  if (productos.error) throw productos.error;
  if (variantes.error) throw variantes.error;
  return new Set(
    [...(productos.data ?? []), ...(variantes.data ?? [])]
      .map((r) => r.codigo_barras)
      .filter((c): c is string => Boolean(c))
  );
}

/**
 * `n` codigos de barras internos libres: EAN-13 "200..." (prefijo GS1 de uso
 * interno, con verificador valido; ver `lib/codigo-barras.ts`). Antes se
 * generaba "750" + consecutivo: 750 es el prefijo de Mexico (chocaba con
 * productos reales) y el ultimo digito no era un verificador.
 */
export async function generarCodigosDeBarras(tenantId: string, n: number): Promise<string[]> {
  return elegirCodigosLibres(n, (codigos) => codigosEnUso(tenantId, codigos));
}

export interface AsignacionCodigo {
  tipo: "producto" | "variante";
  id: string;
}

/**
 * Da un codigo interno nuevo a productos o variantes que no tienen (desde
 * "Imprimir etiquetas"). Solo llena los vacios: un codigo existente nunca se
 * sobrescribe. Devuelve el codigo asignado por clave `tipo:id`; los que fallan
 * van en `errores` sin detener a los demas.
 */
export async function asignarCodigosGenerados(
  tenantId: string,
  asignaciones: AsignacionCodigo[]
): Promise<{ asignados: Map<string, string>; errores: string[] }> {
  const supabase = createSupabaseBrowserClient();
  const codigos = await generarCodigosDeBarras(tenantId, asignaciones.length);
  const asignados = new Map<string, string>();
  const errores: string[] = [];
  await Promise.all(
    asignaciones.map(async (a, i) => {
      const tabla = a.tipo === "producto" ? "productos" : "variantes_producto";
      const vacio = "codigo_barras.is.null,codigo_barras.eq.";
      const { data, error } = await supabase
        .from(tabla)
        .update({ codigo_barras: codigos[i] })
        .eq("id", a.id)
        .eq("tenant_id", tenantId)
        .or(vacio)
        .select("id");
      if (error) errores.push(error.message);
      else if (data && data.length > 0) asignados.set(`${a.tipo}:${a.id}`, codigos[i]);
    })
  );
  return { asignados, errores };
}

export async function generateNextBarcode(tenantId: string): Promise<string> {
  const [codigo] = await generarCodigosDeBarras(tenantId, 1);
  return codigo;
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
 * Crea el "producto general" de un producto con variantes: solo el nombre, su
 * unidad (la que heredan las variantes que no elijan la suya, migracion 104) y
 * su categoria. Precio, costo y stock en 0: lo que se vende son sus variantes,
 * que se crean justo despues con este id. Sin codigo de barras (cada variante
 * lleva el suyo); SKU automatico.
 */
export async function crearProductoConVariantes(
  tenantId: string,
  datos: {
    nombre: string;
    unidad_medida: Producto["unidad_medida"];
    categoria: string | null;
    /** Producto de servicio: sus variantes se venden sin descontar stock. */
    es_servicio?: boolean;
    /** Lotes y caducidad: se registran por producto en la pestaña Lotes. */
    permite_lotes?: boolean;
  }
): Promise<string> {
  const sku = await generateNextSku(tenantId).catch(() => null);
  return createProduct(tenantId, {
    nombre: datos.nombre,
    descripcion: null,
    codigo_barras: null,
    sku,
    unidad_medida: datos.unidad_medida,
    precio_venta: 0,
    costo_compra: 0,
    stock_actual: 0,
    stock_minimo: 0,
    es_servicio: Boolean(datos.es_servicio),
    categoria: datos.categoria,
    permite_lotes: Boolean(datos.permite_lotes),
    permite_variantes: true,
    imagen_url: null,
  });
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
