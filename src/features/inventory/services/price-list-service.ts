import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ListaPrecios, PrecioLista } from "@/lib/types/database";

/**
 * Acceso a las listas de precios.
 *
 * Las escrituras exigen `inventory.manage` por RLS (migracion 067); la lectura
 * esta abierta a todo miembro porque en la fase 2 el cajero tendra que elegir
 * una lista al vender.
 */

export type { ListaPrecios, PrecioLista };

/** Una lista con el numero de productos que lleva dentro. */
export interface ListaConConteo extends ListaPrecios {
  productos: number;
}

export interface VarianteConPrecio {
  id: string;
  producto_id: string;
  talla: string | null;
  color: string | null;
  precio_venta: number;
}

/**
 * Variantes con su PRECIO DE VENTA.
 *
 * No se reutiliza `fetchOrderVariants` de las ordenes de compra: aquella trae
 * `costo_compra`, que es el otro numero. Confundirlos aqui pondria el costo
 * como precio de venta de una liquidacion.
 */
export async function fetchVariantsForPricing(
  tenantId: string
): Promise<VarianteConPrecio[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("variantes_producto")
    .select("id, producto_id, talla, color, precio_venta")
    .eq("tenant_id", tenantId)
    .order("talla");
  return data ?? [];
}

export async function fetchPriceLists(
  tenantId: string
): Promise<ListaConConteo[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("listas_precios")
    // El conteo viene agregado por PostgREST: pedirlo aparte serian N+1
    // consultas para pintar unas tarjetas.
    .select("*, precios_lista(count)")
    .eq("tenant_id", tenantId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((l) => {
    const { precios_lista, ...lista } = l as ListaPrecios & {
      precios_lista: { count: number }[];
    };
    return { ...lista, productos: precios_lista?.[0]?.count ?? 0 };
  });
}

export async function fetchPriceList(
  listaId: string
): Promise<ListaPrecios | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("listas_precios")
    .select("*")
    .eq("id", listaId)
    .maybeSingle();
  return data ?? null;
}

export async function fetchPriceListItems(
  listaId: string
): Promise<PrecioLista[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("precios_lista")
    .select("*")
    .eq("lista_id", listaId);
  return data ?? [];
}

export async function createPriceList(
  tenantId: string,
  nombre: string
): Promise<ListaPrecios> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("listas_precios")
    .insert({ tenant_id: tenantId, nombre, creado_por: user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as ListaPrecios;
}

export async function renamePriceList(
  listaId: string,
  nombre: string
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("listas_precios")
    .update({ nombre, actualizado_en: new Date().toISOString() })
    .eq("id", listaId);
  if (error) throw error;
}

export async function setPriceListActive(
  listaId: string,
  activa: boolean
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("listas_precios")
    .update({ activa, actualizado_en: new Date().toISOString() })
    .eq("id", listaId);
  if (error) throw error;
}

export async function deletePriceList(listaId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // Los renglones caen solos por `ON DELETE CASCADE`.
  const { error } = await supabase
    .from("listas_precios")
    .delete()
    .eq("id", listaId);
  if (error) throw error;
}

export interface RenglonNuevo {
  producto_id: string;
  variante_id: string | null;
}

/**
 * Mete productos en la lista, sin precio todavia ("No definido").
 *
 * `upsert` con `ignoreDuplicates`: agregar dos veces el mismo producto no debe
 * reventar ni pisar el precio que ya tuviera. La restriccion
 * `UNIQUE NULLS NOT DISTINCT` de la migracion 067 es la que hace que esto
 * funcione tambien para el producto suelto (`variante_id` nulo).
 */
export async function addItemsToPriceList(
  listaId: string,
  renglones: RenglonNuevo[]
): Promise<void> {
  if (renglones.length === 0) return;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("precios_lista").upsert(
    renglones.map((r) => ({
      lista_id: listaId,
      producto_id: r.producto_id,
      variante_id: r.variante_id,
      precio: null,
    })),
    { onConflict: "lista_id,producto_id,variante_id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function removeItemFromPriceList(
  listaId: string,
  productoId: string,
  varianteId: string | null
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("precios_lista")
    .delete()
    .eq("lista_id", listaId)
    .eq("producto_id", productoId);
  // `.eq(col, null)` genera `col=eq.null`, que en SQL NUNCA es cierto. Para el
  // producto suelto hay que usar `is`.
  q = varianteId === null ? q.is("variante_id", null) : q.eq("variante_id", varianteId);
  const { error } = await q;
  if (error) throw error;
}

export interface PrecioActualizado {
  producto_id: string;
  variante_id: string | null;
  precio: number | null;
}

/**
 * Escribe precios en bloque (una fila o las N del boton de porcentaje).
 *
 * Se manda como `upsert` y no como N `update`: el boton de porcentaje puede
 * tocar el catalogo entero y serian decenas de idas y vueltas.
 */
export async function updatePriceListPrices(
  listaId: string,
  cambios: PrecioActualizado[]
): Promise<void> {
  if (cambios.length === 0) return;
  const supabase = createSupabaseBrowserClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("precios_lista").upsert(
    cambios.map((c) => ({
      lista_id: listaId,
      producto_id: c.producto_id,
      variante_id: c.variante_id,
      precio: c.precio,
      actualizado_en: ahora,
    })),
    { onConflict: "lista_id,producto_id,variante_id" }
  );
  if (error) throw error;

  // La cabecera guarda cuando se modifico por ultima vez, que es lo que pinta
  // la tarjeta del indice.
  await supabase
    .from("listas_precios")
    .update({ actualizado_en: ahora })
    .eq("id", listaId);
}
