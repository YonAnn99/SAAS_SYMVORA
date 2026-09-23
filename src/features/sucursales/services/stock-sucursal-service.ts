import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FilaStockSucursal } from "@/features/sucursales/stock";

/**
 * Existencias por local y traspasos.
 *
 * NADA DE AQUI ESCRIBE `stock_sucursal` A PELO. Todas las escrituras van por
 * RPC (`establecer_stock_sucursal`, `registrar_traspaso`), que validan permiso,
 * negocio y existencias en el servidor y bloquean la fila del producto igual
 * que la venta. La tabla ni siquiera tiene politicas de escritura pensadas para
 * el navegador: lo que decide el inventario lo decide la base.
 */

/**
 * Las existencias de un local (o de varios), fila a fila: producto suelto y
 * variantes. Con varios, RLS ya descarta los locales que el usuario no tiene
 * asignados (migracion 085).
 */
export async function fetchStockSucursal(
  sucursalId: string | readonly string[]
): Promise<FilaStockSucursal[]> {
  const supabase = createSupabaseBrowserClient();
  const ids = typeof sucursalId === "string" ? [sucursalId] : [...sucursalId];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("stock_sucursal")
    .select("producto_id, variante_id, cantidad, se_vende")
    .in("sucursal_id", ids);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    producto_id: f.producto_id as string,
    variante_id: (f.variante_id as string | null) ?? null,
    cantidad: Number(f.cantidad),
    se_vende: Boolean(f.se_vende),
  }));
}

/**
 * Fija lo que hay de un producto en un local. `cantidad` es el valor FINAL
 * ("en Norte hay 12"), no una diferencia: es lo que teclea el usuario en un
 * campo de stock. El servidor calcula el movimiento.
 */
export async function establecerStockSucursal(input: {
  sucursalId: string;
  productoId: string;
  varianteId?: string | null;
  cantidad?: number | null;
  seVende?: boolean | null;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("establecer_stock_sucursal", {
    p_sucursal_id: input.sucursalId,
    p_producto_id: input.productoId,
    p_variante_id: input.varianteId ?? null,
    p_cantidad: input.cantidad ?? null,
    p_se_vende: input.seVende ?? null,
  });
  if (error) throw error;
}

export interface LineaTraspaso {
  productoId: string;
  varianteId?: string | null;
  cantidad: number;
}

/**
 * Mueve mercancia de un local a otro en UNA operacion: o pasan todas las
 * lineas, o ninguna. Si en el origen no hay suficiente de algo, el servidor
 * rechaza el traspaso entero y dice de que producto y cuanto queda.
 */
export async function registrarTraspaso(input: {
  origenId: string;
  destinoId: string;
  lineas: LineaTraspaso[];
  notas?: string | null;
}): Promise<{ traspaso_id: string; lineas: number }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("registrar_traspaso", {
    p_origen_id: input.origenId,
    p_destino_id: input.destinoId,
    p_items: input.lineas.map((l) => ({
      producto_id: l.productoId,
      variante_id: l.varianteId ?? null,
      cantidad: l.cantidad,
    })),
    p_notas: input.notas ?? null,
  });
  if (error) throw error;
  return data as { traspaso_id: string; lineas: number };
}

export interface TraspasoHistorial {
  id: string;
  creado_en: string;
  notas: string | null;
  origen: string;
  destino: string;
  lineas: { producto: string; cantidad: number }[];
}

/** Los ultimos traspasos del negocio, con nombres ya resueltos para pintar. */
export async function fetchTraspasos(
  tenantId: string,
  limite = 30
): Promise<TraspasoHistorial[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("traspasos")
    .select(
      `id, creado_en, notas,
       origen:sucursales!traspasos_sucursal_origen_id_fkey(nombre),
       destino:sucursales!traspasos_sucursal_destino_id_fkey(nombre),
       detalle_traspaso(cantidad, productos(nombre))`
    )
    .eq("tenant_id", tenantId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;

  type Fila = {
    id: string;
    creado_en: string;
    notas: string | null;
    origen: { nombre: string } | null;
    destino: { nombre: string } | null;
    detalle_traspaso: { cantidad: number; productos: { nombre: string } | null }[];
  };

  return ((data ?? []) as unknown as Fila[]).map((t) => ({
    id: t.id,
    creado_en: t.creado_en,
    notas: t.notas,
    origen: t.origen?.nombre ?? "—",
    destino: t.destino?.nombre ?? "—",
    lineas: (t.detalle_traspaso ?? []).map((d) => ({
      producto: d.productos?.nombre ?? "Producto eliminado",
      cantidad: Number(d.cantidad),
    })),
  }));
}
