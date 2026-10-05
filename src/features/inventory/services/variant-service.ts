import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ProductoOption,
  VarianteProducto,
} from "../types/inventory.types";
import type { Atributo } from "../atributos-variante";
import type { UnidadMedida } from "@/lib/unidades";

export interface VarianteInput {
  producto_id: string;
  sku: string | null;
  codigo_barras: string | null;
  talla: string | null;
  color: string | null;
  precio_venta: number;
  costo_compra: number;
  stock_actual: number;
  /** Migracion 103: descripcion y stock minimo propios de la variante. */
  descripcion?: string | null;
  stock_minimo?: number;
  /** Migracion 104: unidad propia; `null` = la del producto. */
  unidad_medida?: UnidadMedida | null;
  /**
   * Migracion 097. `talla`/`color` se mandan igual, como resumen compatible
   * (`resumenCompatible`), para todo lo que ya lee esas columnas.
   */
  atributos?: Atributo[];
  /** Foto de la variante (bucket `product-images`); `null` la quita. */
  imagen_url?: string | null;
}

/**
 * La columna `atributos` no existe todavia (migracion 097 sin aplicar): se
 * reintenta sin ella y la variante queda solo con su resumen talla/color.
 */
function faltaColumnaAtributos(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /atributos/.test(error.message ?? "")
  );
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
    .select("id, nombre, permite_variantes, permite_lotes, stock_minimo, unidad_medida, es_servicio")
    .eq("tenant_id", tenantId)
    .is("archivado_en", null)
    // Todos los productos, no solo los que ya tienen variantes: si no,
    // la PRIMERA variante de un producto nunca se podia crear (el selector
    // salia vacio). Mismo arreglo que `fetchLotProducts`. Los servicios
    // tambien: un servicio puede tener variantes (Corte chico / grande).
    .order("nombre");
  return data ?? [];
}

/** Devuelve el id: con varias sucursales el stock inicial se carga despues. */
export async function createVariant(
  tenantId: string,
  input: VarianteInput
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  let { data, error } = await supabase
    .from("variantes_producto")
    .insert({ tenant_id: tenantId, ...input })
    .select("id")
    .single();
  if (faltaColumnaAtributos(error) && input.atributos) {
    const { atributos: _sin, ...resto } = input;
    void _sin;
    ({ data, error } = await supabase
      .from("variantes_producto")
      .insert({ tenant_id: tenantId, ...resto })
      .select("id")
      .single());
  }
  if (error || !data) throw error ?? new Error("No se creó la variante");

  // Con su primera variante el producto pasa a "Maneja variantes", para que su
  // interruptor en el catalogo diga la verdad. El filtro hace que sea un no-op
  // si ya lo tenia.
  const { error: errorProducto } = await supabase
    .from("productos")
    .update({ permite_variantes: true })
    .eq("id", input.producto_id)
    .eq("tenant_id", tenantId)
    .eq("permite_variantes", false);
  if (errorProducto) throw errorProducto;

  return data.id as string;
}

export async function updateVariant(
  variantId: string,
  input: VarianteInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  let { error } = await supabase
    .from("variantes_producto")
    .update(input)
    .eq("id", variantId);
  if (faltaColumnaAtributos(error) && input.atributos) {
    const { atributos: _sin, ...resto } = input;
    void _sin;
    ({ error } = await supabase.from("variantes_producto").update(resto).eq("id", variantId));
  }
  if (error) throw error;
}

/** Campos sueltos (edicion en la celda del catalogo). */
export async function updateVariantCampos(
  variantId: string,
  campos: Partial<Pick<VarianteInput, "precio_venta" | "costo_compra">>
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("variantes_producto").update(campos).eq("id", variantId);
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