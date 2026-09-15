/**
 * Presupuestos de tiempo para llamadas a terceros.
 *
 * POR QUE EXISTE ESTE ARCHIVO: hasta ahora ninguna llamada saliente del sistema
 * (Conekta, Mercado Pago, Resend, PAC) tenia timeout. En una funcion serverless
 * eso no es "una peticion lenta": la funcion se queda ocupada hasta el tope de
 * la plataforma, Vercel levanta mas instancias para atender el trafico que
 * sigue llegando, y esas tambien se cuelgan contra el mismo proveedor. Un
 * proveedor lento se convierte en una caida propia.
 *
 * La regla es fallar rapido y de forma legible. Es preferible devolver un error
 * claro en 8 segundos que agotar el presupuesto de la funcion sin diagnostico.
 */

/** Milisegundos por proveedor. Subirlos tiene coste: mas tiempo colgado por peticion. */
export const TIMEOUTS = {
  /** Conekta: API REST normal, responde en cientos de ms. */
  conekta: 8_000,
  /** Mercado Pago: idem, mas la terminal fisica que solo recibe la orden. */
  mercadoPago: 8_000,
  /** Resend: envio de correo; nunca debe bloquear una respuesta HTTP. */
  resend: 5_000,
  /**
   * PAC (Finkok / SWSapien): el timbrado CFDI es legitimamente lento — hay un
   * SOAP y el SAT detras. 20s es generoso a proposito; por debajo se cortarian
   * timbrados validos, que es peor que esperar.
   */
  pac: 20_000,
} as const;

/** Error de presupuesto agotado. Se distingue para no confundirlo con un fallo del proveedor. */
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} no respondio en ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Corta una promesa que no se puede abortar de raiz (SDKs que no aceptan
 * AbortSignal, como el de Conekta o el cliente SOAP).
 *
 * OJO con lo que esto NO hace: la operacion subyacente sigue corriendo en
 * segundo plano, solo se deja de esperar. Por eso se usa unicamente donde el
 * proveedor es idempotente o donde el efecto de una llamada huerfana es
 * aceptable. Cuando el cliente admite AbortSignal, usar `timeoutSignal()`, que
 * si cancela la peticion de verdad.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Señal de aborto para `fetch`. Preferible a `withTimeout` porque cancela la
 * peticion de verdad y libera el socket.
 *
 * Respeta una señal previa (por ejemplo la del request entrante) combinandola,
 * para no perder la cancelacion del cliente.
 */
export function timeoutSignal(
  timeoutMs: number,
  existing?: AbortSignal | null
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!existing) return timeout;
  return AbortSignal.any([existing, timeout]);
}
