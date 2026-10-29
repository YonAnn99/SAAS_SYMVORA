import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FilaCatalogo } from "./seleccion";
import type {
  AjusteProductoCatalogo,
  CatalogoConfig,
  CatalogoEncabezado,
  CatalogoPagina,
} from "./types";

/**
 * Módulo Catálogo en línea (migraciones 124-125). Se escribe directo con el
 * cliente de Supabase: la RLS exige `catalog.manage` (SUPER_ADMIN, ORG_ADMIN o
 * a quien el dueño se lo conceda).
 */

const COLUMNAS =
  "tenant_id, activo, slug, whatsapp, mostrar_precios, mostrar_agotados, mensaje, color, portada_url";

export async function obtenerConfigCatalogo(tenantId: string): Promise<CatalogoConfig | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("catalogos_en_linea")
    .select(COLUMNAS)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as CatalogoConfig | null) ?? null;
}

export async function guardarConfigCatalogo(config: CatalogoConfig): Promise<CatalogoConfig> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("catalogos_en_linea")
    .upsert(config, { onConflict: "tenant_id" })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return data as CatalogoConfig;
}

type FilaProducto = {
  id: string;
  nombre: string;
  categoria: string | null;
  imagen_url: string | null;
  precio_venta: number;
  unidad_medida: string;
  permite_variantes: boolean;
  catalogo_productos: AjusteProductoCatalogo | AjusteProductoCatalogo[] | null;
};

const BLOQUE = 1000;

/** Productos activos con su ajuste del catálogo (sin fila = publicado). */
export async function listarFilasCatalogo(tenantId: string): Promise<FilaCatalogo[]> {
  const supabase = createSupabaseBrowserClient();
  const filas: FilaCatalogo[] = [];
  for (let desde = 0; ; desde += BLOQUE) {
    const { data, error } = await supabase
      .from("productos")
      .select(
        "id, nombre, categoria, imagen_url, precio_venta, unidad_medida, permite_variantes, catalogo_productos(oculto, destacado, precio_especial)"
      )
      .eq("tenant_id", tenantId)
      .is("archivado_en", null)
      .order("nombre")
      .range(desde, desde + BLOQUE - 1);
    if (error) throw error;
    for (const p of (data ?? []) as FilaProducto[]) {
      const ajuste = Array.isArray(p.catalogo_productos) ? p.catalogo_productos[0] : p.catalogo_productos;
      filas.push({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria?.trim() || null,
        imagen_url: p.imagen_url,
        precio_venta: Number(p.precio_venta),
        unidad_medida: p.unidad_medida,
        tieneVariantes: p.permite_variantes,
        oculto: ajuste?.oculto ?? false,
        destacado: ajuste?.destacado ?? false,
        precio_especial: ajuste?.precio_especial != null ? Number(ajuste.precio_especial) : null,
      });
    }
    if (!data || data.length < BLOQUE) break;
  }
  return filas;
}

/** Guarda los ajustes de uno o varios productos de una vez. */
export async function guardarAjustesProductos(
  tenantId: string,
  ajustes: ({ producto_id: string } & AjusteProductoCatalogo)[]
): Promise<void> {
  if (ajustes.length === 0) return;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("catalogo_productos")
    .upsert(
      ajustes.map((a) => ({ ...a, tenant_id: tenantId })),
      { onConflict: "producto_id" }
    );
  if (error) throw error;
}

/** Recorta al centro a 1600×500 (3.2 : 1) y convierte a webp. */
function recortarPortada(file: File, ancho = 1600, alto = 500): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const proporcion = ancho / alto;
      let sw = img.width;
      let sh = img.width / proporcion;
      if (sh > img.height) {
        sh = img.height;
        sw = img.height * proporcion;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      const escala = Math.min(1, ancho / sw);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * escala);
      canvas.height = Math.round(sh * escala);
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], "portada.webp", { type: "image/webp" })) : reject(new Error("imagen"))),
        "image/webp",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

/** Sube la portada al bucket público de imágenes (`<tenant>/catalogo/<uuid>.webp`). */
export async function subirPortadaCatalogo(file: File, tenantId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const webp = await recortarPortada(file);
  const ruta = `${tenantId}/catalogo/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("product-images").upload(ruta, webp, { contentType: "image/webp" });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(ruta).data.publicUrl;
}

export async function obtenerVistaPrevia(): Promise<CatalogoEncabezado | null> {
  const { data, error } = await createSupabaseBrowserClient().rpc("catalogo_vista_previa");
  if (error) throw error;
  return (data as CatalogoEncabezado | null) ?? null;
}

export async function obtenerVistaPreviaProductos(
  busqueda: string,
  categoria: string | null,
  offset: number
): Promise<CatalogoPagina> {
  const { data, error } = await createSupabaseBrowserClient().rpc("catalogo_vista_previa_productos", {
    p_busqueda: busqueda || null,
    p_categoria: categoria,
    p_offset: offset,
  });
  if (error) throw error;
  return (data as CatalogoPagina | null) ?? { total: 0, productos: [] };
}

/** Mensaje para el usuario según el error de la base. */
export function mensajeErrorCatalogo(error: unknown): string {
  const e = error as { code?: string; message?: string; hint?: string } | null;
  if (e?.code === "23505") return "Ese enlace ya lo usa otro negocio. Prueba con otro.";
  if (e?.hint === "CUENTA_SOLO_LECTURA") return e.message ?? "Tu cuenta está en solo lectura.";
  if (e?.code === "42501") return "No tienes permiso para cambiar el catálogo.";
  if (e?.code === "23514") return "Hay un dato que no es válido. Revisa el enlace, el WhatsApp, el color o el precio.";
  return "No se pudo guardar. Intenta de nuevo.";
}
