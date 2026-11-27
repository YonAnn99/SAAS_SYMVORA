import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { leerPorTramos } from "@/lib/leer-por-tramos";
import { costoEnvioDeBase } from "@/features/catalogo/envio";
import type { EstadoBase, EstadoPropio, Pedido } from "./types";

/**
 * Pedidos del catálogo (141-146). Se LEEN directo (RLS: `orders.manage`) y se ESCRIBEN solo por funciones de la base:
 * `aceptar_pedido` (valida existencias), `registrar_pago_pedido` (venta + stock + caja, una vez), `mover_pedido_estado`,
 * `editar_pedido`, `guardar_mensaje_pedido`, `cancelar_pedido`, `crear_pedido_interno` y la administración de estados.
 */

const COLUMNAS =
  "id, folio, codigo_seguimiento, cliente_nombre, cliente_telefono, entrega, direccion, nota, estado, estado_id, estado_nombre, estado_color, pagado, pagado_en, metodo_pago, total, costo_envio, mensaje_cliente, nota_interna, origen, venta_id, creado_en, pedido_items(id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio_unitario)";

/** Los estados BASE del motor (migración 146). */
const ESTADOS_BASE: readonly EstadoBase[] = ["nuevo", "confirmado", "en_curso", "entregado", "cancelado"];

const COLUMNAS_ESTADO = "id, nombre, color, base, aplica_a, orden, activo, es_sistema";

export async function fetchPedidos(tenantId: string): Promise<Pedido[]> {
  const supabase = createSupabaseBrowserClient();
  const filas = await leerPorTramos<Record<string, unknown>>((desde, hasta) =>
    supabase
      .from("pedidos_catalogo")
      .select(COLUMNAS)
      .eq("tenant_id", tenantId)
      .order("creado_en", { ascending: false })
      .order("id")
      .range(desde, hasta)
  );
  return filas.map((f) => ({
    ...(f as unknown as Pedido),
    estado: (ESTADOS_BASE.includes(f.estado as EstadoBase) ? f.estado : "nuevo") as EstadoBase,
    total: Number(f.total),
    costo_envio: costoEnvioDeBase(f.costo_envio),
    origen: f.origen === "pos" ? "pos" : "catalogo",
    pedido_items: ((f.pedido_items as Pedido["pedido_items"] | null) ?? []).map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
    })),
  }));
}

/** Los estados propios del negocio (los crea la primera vez que se abre el módulo). */
export async function fetchEstadosPedido(tenantId: string): Promise<EstadoPropio[]> {
  const supabase = createSupabaseBrowserClient();
  const { error: errorSembrar } = await supabase.rpc("sembrar_estados_pedido", { p_tenant: tenantId });
  if (errorSembrar) throw errorSembrar;
  const { data, error } = await supabase
    .from("pedido_estados")
    .select(COLUMNAS_ESTADO)
    .eq("tenant_id", tenantId)
    .order("orden")
    .order("id");
  if (error) throw error;
  return (data ?? []).map((e) => ({ ...(e as unknown as EstadoPropio), orden: Number(e.orden) }));
}

export interface DatosEstado {
  nombre: string;
  color: string;
  base: EstadoPropio["base"];
  aplica_a: EstadoPropio["aplica_a"];
  activo: boolean;
}

export async function guardarEstadoPedido(tenantId: string, id: string | null, datos: DatosEstado): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("guardar_estado_pedido", {
    p_tenant: tenantId,
    p_id: id,
    p_nombre: datos.nombre,
    p_color: datos.color,
    p_base: datos.base,
    p_aplica_a: datos.aplica_a,
    p_activo: datos.activo,
  });
  if (error) throw error;
}

export async function eliminarEstadoPedido(tenantId: string, id: string): Promise<"borrado" | "desactivado"> {
  const { data, error } = await createSupabaseBrowserClient().rpc("eliminar_estado_pedido", { p_tenant: tenantId, p_id: id });
  if (error) throw error;
  return (data as { accion?: string } | null)?.accion === "borrado" ? "borrado" : "desactivado";
}

export async function ordenarEstadosPedido(tenantId: string, ids: string[]): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("ordenar_estados_pedido", { p_tenant: tenantId, p_ids: ids });
  if (error) throw error;
}

export async function aceptarPedido(id: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("aceptar_pedido", { p_id: id });
  if (error) throw error;
}

export async function moverPedidoEstado(id: string, estadoId: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("mover_pedido_estado", { p_id: id, p_estado_id: estadoId });
  if (error) throw error;
}

export async function registrarPagoPedido(
  id: string,
  metodoPago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA",
  aceptaDiferencia = false
): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("registrar_pago_pedido", {
    p_id: id,
    p_metodo_pago: metodoPago,
    p_acepta_diferencia: aceptaDiferencia,
  });
  if (error) throw error;
}

export interface LineaEdicion {
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
}

export async function editarPedido(id: string, lineas: LineaEdicion[]): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("editar_pedido", {
    p_id: id,
    p_items: lineas.map((l) => ({ producto_id: l.producto_id, variante_id: l.variante_id, cantidad: l.cantidad })),
  });
  if (error) throw error;
}

export async function guardarMensajePedido(id: string, mensajeCliente: string, notaInterna: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("guardar_mensaje_pedido", {
    p_id: id,
    p_mensaje_cliente: mensajeCliente,
    p_nota_interna: notaInterna,
  });
  if (error) throw error;
}

export async function cancelarPedido(id: string, motivo: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("cancelar_pedido", { p_id: id, p_motivo: motivo });
  if (error) throw error;
}
