import type { EntregaPedido, EstadoPedido } from "@/features/catalogo/pedido-envio";

/**
 * Qué puede hacer el negocio con un pedido según su estado (migración 141). Espejo de las funciones de la base
 * (`confirmar_pedido`, `cambiar_estado_pedido`, `cancelar_pedido`): la base manda; esto decide qué botones se pintan.
 *
 *   nuevo ──confirmar──▶ confirmado ──▶ pago · en_produccion · listo · en_camino · entregado (se puede saltar lo que
 *   no aplique y corregir hacia atrás entre ellos). `entregado` y `cancelado` son finales; cancelar vale en cualquier
 *   momento antes de entregar (y, si ya hay venta, la cancela y regresa el stock).
 */

export type AccionPedido = "confirmar" | "pago" | "en_produccion" | "listo" | "en_camino" | "entregado" | "cancelar";

/** Estados que se mueven con `cambiar_estado_pedido`, en orden. */
export const ESTADOS_DE_AVANCE = ["pago", "en_produccion", "listo", "en_camino", "entregado"] as const;
export type EstadoDeAvance = (typeof ESTADOS_DE_AVANCE)[number];

export function accionesDe(estado: EstadoPedido, entrega: EntregaPedido): AccionPedido[] {
  if (estado === "nuevo") return ["confirmar", "cancelar"];
  if (estado === "entregado" || estado === "cancelado") return [];
  const avance = ESTADOS_DE_AVANCE.filter((e) => e !== estado && !(e === "en_camino" && entrega === "recoger"));
  return [...avance, "cancelar"];
}

/** El paso que el botón principal propone: el siguiente de la lista que aplica. */
export function siguientePaso(estado: EstadoPedido, entrega: EntregaPedido): EstadoDeAvance | null {
  if (estado === "nuevo" || estado === "entregado" || estado === "cancelado") return null;
  const orden = ESTADOS_DE_AVANCE.filter((e) => !(e === "en_camino" && entrega === "recoger"));
  const i = estado === "confirmado" ? -1 : orden.indexOf(estado as EstadoDeAvance);
  return orden[i + 1] ?? null;
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

export type CodigoErrorPedido = "noStock" | "plan" | "readOnly" | "noPermission" | "final" | "generic";

/** Códigos para traducir; el texto crudo de la base no sale. */
export function codigoDeErrorPedido(mensaje: string | null | undefined): CodigoErrorPedido {
  const t = mensaje ?? "";
  if (/plan_sin_pedidos/.test(t)) return "plan";
  if (/solo lectura/i.test(t)) return "readOnly";
  if (/No tienes permiso|No perteneces|No autorizado/i.test(t)) return "noPermission";
  if (/stock|existencia|insuficiente|disponible/i.test(t)) return "noStock";
  if (/ya no se puede|Solo se puede confirmar/i.test(t)) return "final";
  return "generic";
}
