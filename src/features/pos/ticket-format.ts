import type { CartItem } from "./types/pos.types";

/**
 * Formato del ticket impreso. Vive aparte del componente porque es lo unico
 * con reglas: el resto es maquetacion.
 */

/** Metodos que imprimen las lineas de recibido y cambio. */
const METODOS_CON_EFECTIVO = new Set(["EFECTIVO"]);

/**
 * Numero de operacion del ticket: los 8 primeros caracteres del UUID.
 *
 * NO es un folio inventado: es la MISMA convencion que ya usa la base de datos.
 * `_crear_venta_desde_items` describe el movimiento de caja como
 * `'Venta #' || LEFT(v_venta_id::text, 8)`, asi que el numero del papel coincide
 * con el que el dueño ve en Finanzas y sirve para localizar la venta.
 *
 * Online se le pasa el id de `ventas`; sin conexion no existe todavia, y se usa
 * la clave de idempotencia, que es con la que el servidor deduplica al
 * sincronizar — o sea que sigue apuntando a la misma venta cuando suba.
 */
export function numeroOperacion(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const limpio = ref.replace(/-/g, "");
  if (!limpio) return null;
  return limpio.slice(0, 8).toUpperCase();
}

/**
 * Unidades vendidas, NO lineas del ticket.
 *
 * Dos productos con 3 unidades cada uno son 6 articulos, no 2. Es lo que
 * significa "Cant. total de items" en el ticket de referencia y lo que el
 * cliente cuenta en la bolsa.
 */
export function totalArticulos(items: CartItem[]): number {
  return items.reduce((suma, item) => suma + item.cantidad, 0);
}

/** Importe de una linea: precio unitario x cantidad, ya con su descuento. */
export function subtotalLinea(item: CartItem): number {
  return item.precioUnitario * item.cantidad - (item.descuento ?? 0);
}

/** Importes siempre con dos decimales; el ticket se lee en columna. */
export function formatearImporte(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Si se imprimen las lineas de efectivo recibido y cambio.
 *
 * Con tarjeta o transferencia no hay cambio que devolver, y sacar un "Cambio
 * $0.00" en el papel confunde a quien lo lee.
 */
export function muestraEfectivo(
  metodoPago: string,
  montoRecibido: number | null | undefined
): boolean {
  return METODOS_CON_EFECTIVO.has(metodoPago) && montoRecibido != null;
}

/** Fecha del ticket en el formato del comprobante de referencia. */
export function fechaTicket(fecha: Date = new Date()): string {
  return fecha.toLocaleString("es-MX", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
