/**
 * Consentimiento de cookies (aviso de la landing y "Configurar cookies").
 *
 * Categorias:
 * - Esenciales (siempre): sesion, idioma, seguridad y esta misma cookie.
 * - Medicion anonima (opcional): Vercel Web Analytics y Speed Insights. No usan
 *   cookies ni identifican a nadie; se cargan SALVO que la persona la rechace
 *   (asi el panel de la app, donde no sale el aviso, mide igual que antes).
 *
 * La cookie `symvora_consent` guarda la eleccion: `v2:todas` o `v2:esenciales`.
 * El valor de la primera version (`accepted`, solo habia "Aceptar") cuenta como
 * "todas": quien ya acepto no vuelve a ver el aviso.
 */

export const COOKIE_CONSENTIMIENTO = "symvora_consent";
/** 180 dias: con los 7 de antes el aviso volvia cada semana. */
export const DURACION_CONSENTIMIENTO = 60 * 60 * 24 * 180;
export const EVENTO_CONFIGURAR = "symvora:configurar-cookies";

const TODAS = "v2:todas";
const ESENCIALES = "v2:esenciales";
const VIEJO_ACEPTADO = "accepted";

export interface Consentimiento {
  /** Ya eligio (acepto, rechazo o guardo preferencias). */
  decidido: boolean;
  /** Medicion anonima permitida. */
  medicion: boolean;
}

/** Lee la eleccion de `document.cookie`. Sin cookie: sin decidir, con medicion. */
export function leerConsentimiento(cookies: string): Consentimiento {
  const valores = cookies
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.startsWith(`${COOKIE_CONSENTIMIENTO}=`))
    .map((c) => decodeURIComponent(c.slice(COOKIE_CONSENTIMIENTO.length + 1)));
  // Si conviven la de dominio y una vieja del host, manda la de la version 2.
  const valor = valores.find((v) => v === TODAS || v === ESENCIALES) ?? valores[0];
  if (valor === ESENCIALES) return { decidido: true, medicion: false };
  if (valor === TODAS || valor === VIEJO_ACEPTADO) return { decidido: true, medicion: true };
  return { decidido: false, medicion: true };
}

/**
 * Cadenas para `document.cookie`. En symvora.com.mx la eleccion va a todo el
 * dominio (www, app y demo comparten la decision) y se borra la del host que
 * dejaba la primera version, para que no conviva con la nueva.
 */
export function cookiesDeConsentimiento(medicion: boolean, hostname: string): string[] {
  const valor = medicion ? TODAS : ESENCIALES;
  const base = `${COOKIE_CONSENTIMIENTO}=${valor}; path=/; max-age=${DURACION_CONSENTIMIENTO}; samesite=lax`;
  if (!hostname.endsWith("symvora.com.mx")) return [base];
  return [`${COOKIE_CONSENTIMIENTO}=; path=/; max-age=0`, `${base}; domain=.symvora.com.mx`];
}

// ---------------------------------------------------------------------------
// Store para React (useSyncExternalStore)
// ---------------------------------------------------------------------------

const oyentes = new Set<() => void>();
let ultimaCadena: string | null = null;
let ultimo: Consentimiento = { decidido: false, medicion: true };

export function suscribirConsentimiento(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Misma referencia mientras la cookie no cambie (lo exige useSyncExternalStore). */
export function consentimientoActual(): Consentimiento {
  const cadena = typeof document === "undefined" ? "" : document.cookie;
  if (cadena !== ultimaCadena) {
    ultimaCadena = cadena;
    ultimo = leerConsentimiento(cadena);
  }
  return ultimo;
}

/** En el servidor: como "ya decidido" (no se pinta el aviso) y con medicion. */
export const CONSENTIMIENTO_SERVIDOR: Consentimiento = { decidido: true, medicion: true };

export function guardarConsentimiento(medicion: boolean): void {
  for (const c of cookiesDeConsentimiento(medicion, window.location.hostname)) document.cookie = c;
  oyentes.forEach((o) => o());
}

/** Reabre el panel de configuracion (boton "Configurar cookies" del pie). */
export function abrirConfiguracionCookies(): void {
  window.dispatchEvent(new Event(EVENTO_CONFIGURAR));
}
