import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

function securityHeaders() {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.sentry-cdn.com" +
      (isDev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://lh3.googleusercontent.com",
    "font-src 'self' data: https://unpkg.com https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.conekta.io https://*.conekta.io https://*.sentry.io https://challenges.cloudflare.com" +
      (isDev ? " ws://localhost:*" : ""),
    "frame-src https://challenges.cloudflare.com https://*.conekta.io",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      // `camera=(self)` y no `camera=()`: desde el movil se puede tomar la foto
      // del producto. Ese flujo usa `<input capture>`, que delega en la app de
      // camara del sistema y seguramente no lo gobierna esta cabecera — pero si
      // algun navegador si la aplicara, el boton abriria el explorador de
      // archivos sin decir por que. Vetarnos a nosotros mismos no protege de
      // nada: `self` sigue excluyendo a cualquier iframe de terceros.
      value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.1.75:3000"],
  outputFileTracingIncludes: {
    "/api/**": ["./resources/cfdi/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: isDev,
  // El valor por defecto es TRUE, y hace que `sw-entry` registre
  // `window.addEventListener("online", () => location.reload())`.
  //
  // En una caja registradora eso es inaceptable: al volver la red la pagina se
  // recarga sola y SE PIERDE EL CARRITO a medio cobrar. Ademas, ese listener se
  // registra al inicializar el bundle, antes que cualquier `useEffect`, asi que
  // ganaba la carrera a los nuestros: el precalentado de rutas
  // (`offline-route-warmer`) y la sincronizacion de ventas (`use-sale-sync`)
  // escuchan el mismo evento `online` y nunca llegaban a ejecutarse.
  reloadOnOnline: false,
});

export default withSerwist(
  withSentryConfig(withNextIntl(nextConfig), {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
  })
);
