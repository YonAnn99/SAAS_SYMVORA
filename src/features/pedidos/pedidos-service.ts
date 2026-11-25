import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { leerPorTramos } from "@/lib/leer-por-tramos";
import { esEstadoPedido } from "@/features/catalogo/pedido-envio";
import type { Pedido } from "./types";

/**
 * Pedidos del catálogo (migración 141). Se LEE directo (RLS: `orders.manage`) y se ESCRIBE solo por funciones
 * SECURITY DEFINER: `confirmar_pedido` (crea la venta y baja el stock), `cambiar_estado_pedido` y `cancelar_pedido`.
 */

const COLUMNAS =
  "id, folio, codigo_seguimiento, cliente_nombre, cliente_telefono, entrega, direccion, nota, estado, pagado, metodo_pago, total, venta_id, creado_en, pedido_items(id, nombre, variante, unidad, cantidad, precio_unitario)";

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
    estado: esEstadoPedido(f.estado) ? f.estado : "nuevo",
    total: Number(f.total),
    pedido_items: ((f.pedido_items as Pedido["pedido_items"] | null) ?? []).map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
    })),
  }));
}

export async function confirmarPedido(
  id: string,
  metodoPago: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA",
  aceptaDiferencia = false
): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("confirmar_pedido", {
    p_id: id,
    p_metodo_pago: metodoPago,
    p_acepta_diferencia: aceptaDiferencia,
  });
  if (error) throw error;
}

export async function cambiarEstadoPedido(id: string, estado: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("cambiar_estado_pedido", { p_id: id, p_estado: estado });
  if (error) throw error;
}

export async function cancelarPedido(id: string, motivo: string): Promise<void> {
  const { error } = await createSupabaseBrowserClient().rpc("cancelar_pedido", { p_id: id, p_motivo: motivo });
  if (error) throw error;
}
