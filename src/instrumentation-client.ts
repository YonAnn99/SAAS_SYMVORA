import * as Sentry from "@sentry/nextjs";
import { isMarketingPath } from "@/lib/rutas-marketing";

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
  // Replay NO va aqui: se carga bajo demanda (ver `asegurarReplay`).
  integrations: [],
});

/**
 * Sentry Replay solo en el sistema, nunca en la landing.
 *
 * Replay (rrweb) pesaba ~600 KB de JS en CADA visita a la landing, donde no
 * sirve de nada: es para ver que hizo el cajero antes de un error. Ahora se
 * descarga del CDN de Sentry (`browser.sentry-cdn.com`, permitido en la CSP de
 * next.config.ts) la primera vez que se entra a una ruta del sistema, ya sea
 * al cargar la pagina o al navegar desde la landing (registro -> panel).
 */
let replayPedido = false;

function asegurarReplay(ruta: string) {
  if (replayPedido || isMarketingPath(ruta)) return;
  replayPedido = true;
  Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      Sentry.addIntegration(
        replayIntegration({
          // El POS maneja datos de clientes y montos. Por defecto Sentry ya
          // enmascara texto y entradas; se deja explicito para que nadie lo
          // relaje sin darse cuenta de lo que implica.
          maskAllText: true,
          blockAllMedia: true,
        })
      );
    })
    .catch(() => {
      // CDN bloqueado o sin red: la app sigue igual, solo sin grabacion.
      replayPedido = false;
    });
}

if (typeof window !== "undefined") {
  asegurarReplay(window.location.pathname);
}

/**
 * Sin esto las navegaciones del App Router no se instrumentan y el SDK avisa
 * en cada build con un "ACTION REQUIRED".
 */
export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart = (
  href,
  navigationType
) => {
  Sentry.captureRouterTransitionStart(href, navigationType);
  asegurarReplay(new URL(href, window.location.href).pathname);
};
