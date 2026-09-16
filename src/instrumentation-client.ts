import * as Sentry from "@sentry/nextjs";

/**
 * Sentry en el navegador.
 *
 * ⚠️ ESTE ARCHIVO SUSTITUYE A `src/sentry.client.config.ts`, QUE NUNCA SE
 * CARGO. El SDK busca el config de cliente clasico SOLO en la raiz del
 * proyecto (`getClientSentryConfigFile` en
 * `@sentry/nextjs/build/cjs/config/webpack.js` resuelve contra `projectDir`,
 * sin mirar `src/`), y aqui estaba dentro de `src/`. En cambio
 * `instrumentation-client.ts` si se busca en `src/`, que es donde vive el
 * codigo de este proyecto.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Muestreo al 10%. Al 100% la cuota de Sentry se consume justo durante un
  // pico de trafico, que es exactamente cuando hace falta la visibilidad.
  tracesSampleRate: 0.1,
  debug: false,

  // Repeticion de sesion: el 10% de las sesiones al azar y el 10% de las que
  // terminan en error. Ver que hizo el cajero antes de reventar vale mas que
  // el stack trace en una interfaz tactil.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      // El POS maneja datos de clientes y montos. Por defecto Sentry ya
      // enmascara texto y entradas; se deja explicito para que nadie lo
      // relaje sin darse cuenta de lo que implica.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

/**
 * Sin esto las navegaciones del App Router no se instrumentan y el SDK avisa
 * en cada build con un "ACTION REQUIRED".
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
