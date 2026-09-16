import * as Sentry from "@sentry/nextjs";

/**
 * Punto de arranque de la instrumentacion del servidor.
 *
 * ⚠️ SIN ESTE FICHERO, `sentry.server.config.ts` y `sentry.edge.config.ts` NO
 * SE IMPORTAN NUNCA. Estaban escritos desde el 2026-08-30 pero Next no los
 * cargaba: desde `@sentry/nextjs` v8 la unica via de entrada del lado servidor
 * es el hook `register()` de este archivo. El resultado era que ningun error de
 * servidor, ni de las 28 rutas de API, llegaba a Sentry — y sin ruido en el
 * panel parecia que no habia errores.
 *
 * Va en `src/` porque el proyecto usa esa carpeta; Next lo busca en la raiz o
 * dentro de `src/`, no en los dos a la vez.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // El middleware y las rutas con `runtime = "edge"` corren en otro runtime,
  // con su propia inicializacion.
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Errores de Server Components, route handlers y middleware.
 *
 * `register()` por si solo no los captura: Next los atrapa antes de que
 * escapen, asi que hay que engancharse aqui para verlos.
 */
export const onRequestError = Sentry.captureRequestError;
