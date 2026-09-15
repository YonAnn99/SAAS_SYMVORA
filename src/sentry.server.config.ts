import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Muestreo al 10%. Al 100% la cuota de Sentry se consume justo durante un
  // pico de trafico, que es exactamente cuando hace falta la visibilidad.
  tracesSampleRate: 0.1,
  debug: false,
});
