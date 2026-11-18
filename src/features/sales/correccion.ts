/**
 * Corrección de una venta (migración 137): el detalle de la venta guarda aquí
 * cuál se corrige y por qué, y el Punto de Venta lo recoge para cargar el
 * carrito. En `sessionStorage`: sobrevive a la navegación y a una recarga, pero
 * no pasa a otra pestaña ni a otro día.
 */

const CLAVE = "symvora-correccion";

export interface CorreccionPendiente {
  ventaId: string;
  motivo: string;
  /** Quién la pidió: si cambia la sesión, se descarta. */
  userId: string;
}

export function guardarCorreccion(c: CorreccionPendiente): void {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    // Almacenamiento bloqueado: el POS no la verá y se cobrará como venta normal
    // solo si la persona lo hace a propósito (no se carga nada al carrito).
  }
}

/** La corrección pendiente de ESTE usuario, o `null`. */
export function leerCorreccion(userId: string | null): CorreccionPendiente | null {
  if (!userId) return null;
  try {
    const crudo = JSON.parse(window.sessionStorage.getItem(CLAVE) ?? "null") as Partial<CorreccionPendiente> | null;
    if (
      !crudo ||
      typeof crudo.ventaId !== "string" ||
      typeof crudo.motivo !== "string" ||
      crudo.userId !== userId
    ) {
      return null;
    }
    return { ventaId: crudo.ventaId, motivo: crudo.motivo, userId: crudo.userId };
  } catch {
    return null;
  }
}

export function soltarCorreccion(): void {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer.
  }
}
