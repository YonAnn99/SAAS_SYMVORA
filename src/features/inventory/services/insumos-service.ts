import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { etiquetaAtributos } from "../atributos-variante";
import type { InsumoLinea, RecetasServicio } from "../insumos";
import { construirOpciones, type OpcionCompra } from "../purchase-order-items";

type FilaReceta = {
  servicio_id: string;
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
  productos: { nombre: string; archivado_en: string | null } | null;
  variantes_producto: {
    talla: string | null;
    color: string | null;
    atributos: { tipo: string; valor: string }[] | null;
    archivado_en: string | null;
  } | null;
};

const SELECT_RECETA =
  "servicio_id, producto_id, variante_id, cantidad, orden, " +
  "productos!insumos_servicio_producto_id_fkey(nombre, archivado_en), " +
  "variantes_producto(talla, color, atributos, archivado_en)";

function aInsumo(f: FilaReceta): InsumoLinea | null {
  // Un insumo archivado no se descuenta (el servidor lo salta): no se muestra.
  if (!f.productos || f.productos.archivado_en) return null;
  if (f.variante_id && (!f.variantes_producto || f.variantes_producto.archivado_en)) return null;
  const variante = f.variantes_producto ? etiquetaAtributos(f.variantes_producto) : "";
  return {
    productId: f.producto_id,
    varianteId: f.variante_id,
    cantidad: Number(f.cantidad),
    nombre: variante ? `${f.productos.nombre} · ${variante}` : f.productos.nombre,
  };
}

/** Todas las recetas del negocio, para el POS. */
export async function fetchRecetasServicios(tenantId: string): Promise<RecetasServicio> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("insumos_servicio")
    .select(SELECT_RECETA)
    .eq("tenant_id", tenantId)
    .order("orden");
  if (error) throw error;
  const recetas: RecetasServicio = new Map();
  for (const f of (data ?? []) as unknown as FilaReceta[]) {
    const insumo = aInsumo(f);
    if (!insumo) continue;
    recetas.set(f.servicio_id, [...(recetas.get(f.servicio_id) ?? []), insumo]);
  }
  return recetas;
}

/** La receta de un servicio, para editarla. */
export async function fetchRecetaServicio(servicioId: string): Promise<InsumoLinea[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("insumos_servicio")
    .select(SELECT_RECETA)
    .eq("servicio_id", servicioId)
    .order("orden");
  if (error) throw error;
  return ((data ?? []) as unknown as FilaReceta[])
    .map(aInsumo)
    .filter((i): i is InsumoLinea => i !== null);
}

/** Reemplaza la receta completa (`guardar_insumos_servicio`). */
export async function guardarRecetaServicio(servicioId: string, insumos: InsumoLinea[]): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("guardar_insumos_servicio", {
    p_servicio_id: servicioId,
    p_items: insumos.map((i) => ({
      producto_id: i.productId,
      variante_id: i.varianteId,
      cantidad: i.cantidad,
    })),
  });
  if (error) throw error;
}

/**
 * Lo que se puede elegir como insumo: productos fisicos activos y, si tienen
 * variantes, cada variante (el producto general de uno con variantes no, porque
 * su stock vive en las variantes).
 */
export async function fetchOpcionesInsumo(tenantId: string): Promise<OpcionCompra[]> {
  const supabase = createSupabaseBrowserClient();
  const [productos, variantes] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre, costo_compra, categoria")
      .eq("tenant_id", tenantId)
      .eq("es_servicio", false)
      .is("archivado_en", null)
      .order("nombre"),
    supabase
      .from("variantes_producto")
      .select("id, producto_id, talla, color, atributos, costo_compra")
      .eq("tenant_id", tenantId)
      .is("archivado_en", null),
  ]);
  if (productos.error) throw productos.error;
  if (variantes.error) throw variantes.error;
  const conVariantes = new Set((variantes.data ?? []).map((v) => v.producto_id as string));
  return construirOpciones(productos.data ?? [], variantes.data ?? []).filter(
    (o) => o.varianteId !== null || !conVariantes.has(o.productoId)
  );
}

export interface InsumoDeVenta {
  servicio_id: string;
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
  faltante: number;
  nombre: string;
}

/** Lo que uso cada servicio de una venta, con lo que falto (detalle de venta). */
export async function fetchInsumosDeVenta(ventaId: string): Promise<InsumoDeVenta[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("detalle_venta_insumos")
    .select(
      "servicio_id, producto_id, variante_id, cantidad, faltante, " +
        "productos!detalle_venta_insumos_producto_id_fkey(nombre), " +
        "variantes_producto(talla, color, atributos)"
    )
    .eq("venta_id", ventaId);
  if (error) throw error;
  type Fila = Omit<InsumoDeVenta, "nombre"> & {
    productos: { nombre: string } | null;
    variantes_producto: FilaReceta["variantes_producto"];
  };
  return ((data ?? []) as unknown as Fila[]).map((f) => {
    const variante = f.variantes_producto ? etiquetaAtributos(f.variantes_producto) : "";
    const base = f.productos?.nombre ?? "Producto";
    return {
      servicio_id: f.servicio_id,
      producto_id: f.producto_id,
      variante_id: f.variante_id,
      cantidad: Number(f.cantidad),
      faltante: Number(f.faltante),
      nombre: variante ? `${base} · ${variante}` : base,
    };
  });
}
