/**
 * Cuando el boton de cobrar debe estar deshabilitado, y por que.
 *
 * Vive aparte y devuelve el MOTIVO en vez de un booleano por dos razones:
 *
 * 1. La condicion estaba escrita dos veces en linea en la pagina del POS (una
 *    para escritorio y otra para la hoja movil). Esa duplicacion es justo lo
 *    que dejo sobrevivir el fallo que se corrige aqui: el bloqueo por
 *    `!isOnline` entro con la PWA el 31-08, la cola de ventas offline llego el
 *    10-09, y nadie quito el bloqueo. Resultado: la rama offline de
 *    `handleCompleteSale` era codigo muerto desde la interfaz, porque el boton
 *    estaba apagado justo cuando hacia falta.
 * 2. Con el motivo a mano la pantalla puede explicar que pasa en vez de
 *    limitarse a apagar un boton.
 */

/**
 * Metodos de pago permitidos sin conexion.
 *
 * Se dejan fuera a proposito:
 *  - TARJETA_TERMINAL: MercadoPago Point necesita red por definicion.
 *  - CREDITO: hay que validar `saldo_pendiente` del cliente contra el
 *    servidor; hacerlo con datos cacheados permitiria pasarse del limite de
 *    credito sin que nada lo detecte hasta sincronizar.
 *  - TRANSFERENCIA: el cajero no puede confirmar que el dinero llego.
 */
export const OFFLINE_PAYMENT_METHODS = new Set([
  "EFECTIVO",
  "TARJETA",
]);

export type MotivoBloqueo =
  | "sin-productos"
  | "sin-metodo"
  | "procesando"
  | "monto-insuficiente"
  | "metodo-no-disponible-sin-conexion";

export interface EstadoCobro {
  /** Cuantas lineas hay en el carrito. */
  items: number;
  /** Metodo elegido, o cadena vacia si todavia no hay ninguno. */
  metodoPago: string;
  procesando: boolean;
  /** Solo aplica a efectivo: lo recibido no cubre el total. */
  montoInsuficiente: boolean;
  isOnline: boolean;
}

/**
 * Devuelve el motivo por el que NO se puede cobrar, o `null` si se puede.
 *
 * Sin conexion NO se bloquea la venta: se bloquean solo los metodos de pago
 * que de verdad necesitan red. Lo demas se guarda en IndexedDB y se sube solo.
 */
export function motivoBloqueoCobro(estado: EstadoCobro): MotivoBloqueo | null {
  if (estado.items === 0) return "sin-productos";
  if (!estado.metodoPago) return "sin-metodo";
  if (estado.procesando) return "procesando";
  if (estado.montoInsuficiente) return "monto-insuficiente";
  if (!estado.isOnline && !OFFLINE_PAYMENT_METHODS.has(estado.metodoPago)) {
    return "metodo-no-disponible-sin-conexion";
  }
  return null;
}

/** ¿Se puede elegir este metodo de pago ahora mismo? */
export function metodoDisponible(metodo: string, isOnline: boolean): boolean {
  return isOnline || OFFLINE_PAYMENT_METHODS.has(metodo);
}
