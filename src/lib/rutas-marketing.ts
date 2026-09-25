/**
 * Rutas publicas del sitio de marketing (www): la landing y sus paginas.
 *
 * Vive aparte del middleware para poder usarse TAMBIEN en el navegador
 * (`instrumentation-client.ts` decide con esto si carga Sentry Replay), sin
 * arrastrar al cliente el codigo de Supabase del middleware.
 */

export const MARKETING_SEGMENTS = [
  "/marketing",
  "/terminos",
  "/aviso-privacidad",
  "/politica-cookies",
  // Una pagina por giro (/es/punto-de-venta/papelerias): se sirve en www y es
  // publica. Sin esto, en produccion redirigiria al host de la app, y sin
  // sesion terminaria en el login en lugar de mostrarse.
  "/punto-de-venta",
  // Guias de uso (/es/aprende): publicas y en www. Desde el sistema se enlazan
  // en relativo y esta lista las manda del host de la app al de marketing.
  "/aprende",
];

export function stripLocale(path: string): string {
  const match = path.match(/^\/(es|en)(?=\/|$)/);
  return match ? path.slice(match[0].length) || "/" : path;
}

export function isMarketingPath(path: string): boolean {
  const clean = stripLocale(path);
  if (clean === "/") return true;
  return MARKETING_SEGMENTS.some(
    (segment) => clean === segment || clean.startsWith(`${segment}/`)
  );
}
