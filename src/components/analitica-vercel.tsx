"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics (visitas y paginas vistas; sin cookies). Va en el layout
 * raiz junto a Speed Insights; el script es del propio dominio (/_vercel), la
 * CSP no cambia. Es componente de cliente porque `beforeSend` es una funcion.
 *
 * Analytics manda la URL de cada pagina vista: `limpiarEvento` quita lo que no
 * debe salir del sitio. REGLA: toda ruta nueva con un codigo secreto en la URL
 * se agrega aqui (y a su test).
 */

/** Rutas cuyo ultimo segmento es un codigo que da acceso a algo. */
const RUTAS_CON_CODIGO: [RegExp, string][] = [
  // Cartel del mostrador para registrarse en la lealtad (codigo_alta).
  [/\/tarjeta\/unirse\/[^/]+/, "/tarjeta/unirse/[codigo]"],
  // Tarjeta de lealtad del cliente final: el codigo ES el acceso.
  [/\/tarjeta\/(?!unirse\/|\[codigo\])[^/]+/, "/tarjeta/[codigo]"],
];

export function limpiarUrl(url: string): string {
  let limpia: string;
  try {
    const u = new URL(url);
    // Sin query ni hash: ahi viajan tokens (restablecer contraseña, OAuth).
    limpia = `${u.origin}${u.pathname}`;
  } catch {
    limpia = url.split(/[?#]/)[0];
  }
  for (const [patron, reemplazo] of RUTAS_CON_CODIGO) {
    limpia = limpia.replace(patron, reemplazo);
  }
  return limpia;
}

export function limpiarEvento(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: limpiarUrl(event.url) };
}

export function AnaliticaVercel() {
  return <Analytics beforeSend={limpiarEvento} />;
}
