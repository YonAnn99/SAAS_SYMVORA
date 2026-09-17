/**
 * Que paso la ultima vez que se intento dejar la app lista para trabajar sin
 * conexion.
 *
 * Existe porque el fallo original era INVISIBLE: la PWA no abria en modo avion
 * y no habia forma de saber en que paso se habia roto sin tener el telefono
 * delante y un cable. Ahora cada intento deja constancia, se puede consultar
 * desde el propio dispositivo y, si falla, se manda a Sentry.
 */

export type ResultadoRuta =
  /** Guardada y verificada leyendola de vuelta. */
  | "guardada"
  /** El servidor mando a otro sitio (login, facturacion, sin permiso). */
  | "redirigida"
  /** Respondio, pero no con un 200. */
  | "http-error"
  /** No hubo respuesta: sin red a mitad. */
  | "sin-red"
  /** Se escribio pero al releer no estaba. Lo mas raro y lo mas grave. */
  | "no-verificada";

export interface RutaInformada {
  path: string;
  resultado: ResultadoRuta;
  status?: number;
  /** A donde acabo de verdad, cuando hubo redireccion. */
  pathFinal?: string;
}

export interface WarmReport {
  /** ISO. */
  at: string;
  locale: string;
  /** Que lo disparo: arranque, controlador nuevo, volver a la app, manual... */
  trigger: string;
  rutas: RutaInformada[];
  nota?: string;
}

const CLAVE = "symvora_offline_warm_report";

export function guardarInforme(informe: WarmReport): void {
  try {
    // Solo el ultimo: el historial no aporta y llena el almacenamiento.
    window.localStorage.setItem(CLAVE, JSON.stringify(informe));
  } catch {
    // Sin localStorage el diagnostico se pierde, pero nada mas.
  }
}

export function leerInforme(): WarmReport | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as WarmReport) : null;
  } catch {
    return null;
  }
}

/** Resultados que significan "esto no quedo listo". */
export function informeTieneFallos(informe: WarmReport | null): boolean {
  if (!informe) return false;
  if (informe.nota === "sin-controlador") return true;
  return informe.rutas.some((r) => r.resultado !== "guardada");
}

export interface CacheInspeccionada {
  nombre: string;
  entradas: number;
}

/** Que cachés hay y cuanto guarda cada una. Para el panel de diagnostico. */
export async function inspeccionarCaches(): Promise<CacheInspeccionada[]> {
  if (typeof caches === "undefined") return [];
  try {
    const nombres = await caches.keys();
    return await Promise.all(
      nombres.map(async (nombre) => {
        const cache = await caches.open(nombre);
        const claves = await cache.keys();
        return { nombre, entradas: claves.length };
      })
    );
  } catch {
    return [];
  }
}
