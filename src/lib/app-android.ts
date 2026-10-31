/**
 * ¿SYMVORA corre dentro de la app de Android (TWA, Trusted Web Activity)?
 *
 * Importa por el cobro: Google Play exige su propio sistema de pago para una
 * suscripcion que se vende DENTRO de la app, y no deja mandar al usuario a
 * pagar por fuera. Dentro de la app no se vende nada: /billing muestra el
 * estado sin precios ni botones de pago.
 *
 * Como se reconoce (cualquiera de las dos):
 * - La app abre `…/es/dashboard?app=android` (startUrl de Bubblewrap).
 * - Chrome manda `document.referrer = "android-app://<paquete>/"` en la
 *   primera navegacion de una TWA.
 * Al reconocerla se guarda la cookie `symvora_app=android` (un año, en todo
 * `.symvora.com.mx`): el parametro se pierde en la primera redireccion y el
 * referrer solo llega una vez.
 */

export const COOKIE_APP = "symvora_app";
export const VALOR_ANDROID = "android";

export function vieneDeAppAndroid(url: string, referrer: string): boolean {
  try {
    if (new URL(url).searchParams.get("app") === VALOR_ANDROID) return true;
  } catch {
    // URL invalida: se decide por el referrer.
  }
  return referrer.startsWith("android-app://");
}

export function tieneCookieAndroid(cookies: string): boolean {
  return cookies
    .split(";")
    .some((c) => c.trim() === `${COOKIE_APP}=${VALOR_ANDROID}`);
}

/** La cookie, valida en www. y app. (en localhost, sin dominio). */
export function cookieAndroid(hostname: string): string {
  const dominio = hostname.endsWith("symvora.com.mx") ? "; domain=.symvora.com.mx" : "";
  const segura = hostname === "localhost" ? "" : "; Secure";
  return `${COOKIE_APP}=${VALOR_ANDROID}; path=/; max-age=31536000; SameSite=Lax${dominio}${segura}`;
}
