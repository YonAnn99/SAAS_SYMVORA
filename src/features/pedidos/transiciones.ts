import type { EstadoPropio, EstadoBase, Pedido } from "./types";

/**
 * Qué puede hacer el negocio con un pedido (migración 146). Espejo de las funciones de la base: la base manda; esto
 * decide qué botones se pintan.
 *
 *   nuevo ──aceptar──▶ confirmado ──▶ (estados propios del negocio, en_curso) ──▶ entregado
 *   Pagar es APARTE del estado: `registrar_pago_pedido` crea la venta (stock + caja) una sola vez.
 *   Editar productos solo mientras no esté pagado ni cerrado. Cancelar vale hasta entregado.
 */

/** ¿Se puede aceptar? Solo un pedido nuevo. Verifica existencias en la base. */
export function puedeAceptar(p: Pick<Pedido, "estado">): boolean {
  return p.estado === "nuevo";
}

/** ¿Se puede cambiar su estado propio? Ya aceptado y no cancelado. */
export function puedeCambiarEstado(p: Pick<Pedido, "estado">): boolean {
  return p.estado !== "nuevo" && p.estado !== "cancelado";
}

/** ¿Se puede marcar como pagado? Aceptado, no cancelado y todavía sin venta. */
export function puedePagar(p: Pick<Pedido, "estado" | "pagado" | "venta_id">): boolean {
  return !p.pagado && !p.venta_id && p.estado !== "nuevo" && p.estado !== "cancelado";
}

/** ¿Se pueden editar los productos? Mientras no esté pagado ni cerrado. */
export function puedeEditar(p: Pick<Pedido, "estado" | "pagado" | "venta_id">): boolean {
  return !p.pagado && !p.venta_id && p.estado !== "entregado" && p.estado !== "cancelado";
}

/** ¿Se puede cancelar? Hasta entregado (si ya hay venta, la cancela y regresa el stock). */
export function puedeCancelar(p: Pick<Pedido, "estado">): boolean {
  return p.estado !== "entregado" && p.estado !== "cancelado";
}

/**
 * Los estados propios que se le pueden poner a este pedido: activos, de su tipo (recoger o domicilio) y que no sean
 * de cancelación (eso va por «Cancelar»).
 */
export function estadosDisponibles(p: Pick<Pedido, "entrega">, estados: EstadoPropio[]): EstadoPropio[] {
  return estados
    .filter((e) => e.activo && e.base !== "cancelado")
    .filter((e) => e.aplica_a === "ambos" || e.aplica_a === p.entrega)
    .sort((a, b) => a.orden - b.orden);
}

/** Pedido cerrado para el cliente: ya entregado o cancelado. */
export function estaCerrado(base: EstadoBase): boolean {
  return base === "entregado" || base === "cancelado";
}

/**
 * La base lanza `diferencia_de_precio:<pedido>:<venta>` cuando el total del POS no coincide con el que vio el
 * cliente (precio especial del catálogo, un cambio de precio). Devuelve los dos totales, o null si es otro error.
 */
export function diferenciaDePrecio(mensaje: string | null | undefined): { pedido: number; venta: number } | null {
  const m = /diferencia_de_precio:(-?[\d.]+):(-?[\d.]+)/.exec(mensaje ?? "");
  if (!m) return null;
  const pedido = Number(m[1]);
  const venta = Number(m[2]);
  return Number.isFinite(pedido) && Number.isFinite(venta) ? { pedido, venta } : null;
}

export type CodigoErrorPedido =
  | "noStock"
  | "plan"
  | "readOnly"
  | "noPermission"
  | "final"
  | "yaPagado"
  | "recarga"
  | "generic";

/** Códigos para traducir; el texto crudo de la base no sale. */
export function codigoDeErrorPedido(mensaje: string | null | undefined): CodigoErrorPedido {
  const t = mensaje ?? "";
  if (/plan_sin_pedidos/.test(t)) return "plan";
  if (/solo lectura/i.test(t)) return "readOnly";
  if (/No tienes permiso|No perteneces|No autorizado/i.test(t)) return "noPermission";
  if (/ya está pagado|ya esta pagado/i.test(t)) return "yaPagado";
  if (/cambió: recarga|recarga la página/i.test(t)) return "recarga";
  if (/stock|existencia|insuficiente|disponible|ya no existe|ya no están/i.test(t)) return "noStock";
  if (/ya no se puede|Solo se acepta|Primero acepta/i.test(t)) return "final";
  return "generic";
}
