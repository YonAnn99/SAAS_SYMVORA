/**
 * Cuando el boton de cobrar debe estar deshabilitado, y por que.
 *
 * Vive aparte y devuelve el MOTIVO en vez de un booleano por dos razones:
 *
 * 1. La condicion estaba escrita dos veces en linea en la pagina del POS (una
 *    para escritorio y otra para la hoja movil). Esa duplicacion es justo lo
 *    que dejo sobrevivir durante semanas un bloqueo obsoleto sin que nadie lo
 *    notara.
 * 2. Con el motivo a mano la pantalla puede explicar que pasa en vez de
 *    limitarse a apagar un boton.
 *
 * Aqui ya no hay nada de conexion: el modo sin conexion se retiro del producto
 * (2026-09-20) y cobrar exige internet, como cualquier otra operacion.
 */

export type MotivoBloqueo =
  | "sin-productos"
  | "sin-metodo"
  | "procesando"
  | "monto-insuficiente";

export interface EstadoCobro {
  /** Cuantas lineas hay en el carrito. */
  items: number;
  /** Metodo elegido, o cadena vacia si todavia no hay ninguno. */
  metodoPago: string;
  procesando: boolean;
  /** Solo aplica a efectivo: lo recibido no cubre el total. */
  montoInsuficiente: boolean;
}

/** Devuelve el motivo por el que NO se puede cobrar, o `null` si se puede. */
export function motivoBloqueoCobro(estado: EstadoCobro): MotivoBloqueo | null {
  if (estado.items === 0) return "sin-productos";
  if (!estado.metodoPago) return "sin-metodo";
  if (estado.procesando) return "procesando";
  if (estado.montoInsuficiente) return "monto-insuficiente";
  return null;
}
