/**
 * ¿SYMVORA corre dentro de la app de Android (TWA, Trusted Web Activity)?
 *
 * Importa por el cobro: Google Play exige su propio sistema de pago para una
 * suscripcion que se vende DENTRO de la app, y en Mexico no deja mandar al
 * usuario a pagar por fuera. Dentro de la app no se vende nada: /billing
 * muestra el estado sin precios ni botones de pago. Se paga desde el
 * navegador, al que llevan los correos de prueba y de cobro.
 *
 * Como se reconoce (cualquiera de las dos):
 * - La app abre `…/es/dashboard?app=android` en cada arranque (startUrl de
 *   Bubblewrap).
 * - Chrome manda `document.referrer = "android-app://<paquete>/"` en la
 *   primera navegacion de una TWA.
 *
 * La marca va en `sessionStorage`, que vive solo en la pestaña de la TWA. NO en
 * una cookie: la TWA usa el mismo perfil de Chrome, y con cookie quien usaba la
 * app dejaba de ver los botones de pago tambien en Chrome (2026-10-31). Esa
 * cookie vieja se borra (`borrarCookieVieja`).
 */

export const CLAVE_APP = "symvora_app";
export const VALOR_ANDROID = "android";

/** Lo minimo de `Storage` que se usa: permite probarlo sin navegador. */
export type AlmacenSesion = Pick<Storage, "getItem" | "setItem">;

export function vieneDeAppAndroid(url: string, referrer: string): boolean {
  try {
    if (new URL(url).searchParams.get("app") === VALOR_ANDROID) return true;
  } catch {
    // URL invalida: se decide por el referrer.
  }
  return referrer.startsWith("android-app://");
}

export function esPestanaDeApp(almacen: AlmacenSesion): boolean {
  return almacen.getItem(CLAVE_APP) === VALOR_ANDROID;
}

/** Marca la pestaña si viene de la app. Devuelve si quedo marcada. */
export function marcarSiVieneDeApp(almacen: AlmacenSesion, url: string, referrer: string): boolean {
  if (esPestanaDeApp(almacen)) return true;
  if (!vieneDeAppAndroid(url, referrer)) return false;
  almacen.setItem(CLAVE_APP, VALOR_ANDROID);
  return true;
}

/** Cadenas para expirar la cookie de la primera version (con y sin dominio). */
export function cookiesViejasParaBorrar(hostname: string): string[] {
  const base = `${CLAVE_APP}=; path=/; max-age=0`;
  return hostname.endsWith("symvora.com.mx") ? [base, `${base}; domain=.symvora.com.mx`] : [base];
}
