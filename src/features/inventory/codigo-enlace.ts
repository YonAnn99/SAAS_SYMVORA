/**
 * Codigo corto del enlace publico al PDF de una orden
 * (`https://www.symvora.com.mx/pedido/<codigo>.pdf`, migracion 095).
 *
 * 10 caracteres base62 con el generador criptografico: ~59 bits, imposible de
 * adivinar o de recorrer, y lo bastante corto para que el mensaje de WhatsApp
 * se vea limpio.
 */

const ALFABETO =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const LARGO_CODIGO = 10;

/** Formato valido de un codigo (lo revisa tambien la base con un CHECK). */
export const FORMATO_CODIGO = /^[A-Za-z0-9]{10}$/;

export function generarCodigoEnlace(): string {
  // 256 no es multiplo de 62: se descartan los bytes >= 248 (62 * 4) para que
  // todos los caracteres salgan con la misma probabilidad.
  const limite = 62 * 4;
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    const bytes = crypto.getRandomValues(new Uint8Array(LARGO_CODIGO * 2));
    for (const b of bytes) {
      if (b < limite) codigo += ALFABETO[b % 62];
      if (codigo.length === LARGO_CODIGO) break;
    }
  }
  return codigo;
}
