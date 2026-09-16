/**
 * Enlaces de WhatsApp.
 *
 * Fuente unica. El mismo helper estaba copiado tres veces en marketing
 * (`whatsapp-fab.tsx`, `cta.tsx`, `faq.tsx`) y una cuarta en el boton de
 * referidos de `/billing`; los nuevos usos entran por aqui.
 */

const LADA_MEXICO = "52";

/**
 * Normaliza un telefono mexicano a E.164 sin el `+` (lo que espera `wa.me`).
 *
 * Devuelve `null` cuando no se puede salvar, Y ESO IMPORTA: quien llama debe
 * esconder el boton en ese caso. Un enlace a un numero adivinado abre el chat
 * de un desconocido, que es peor que no ofrecer el boton.
 *
 * `proveedores.telefono` es TEXT libre sin validacion, asi que llega de todo:
 * "5555567678", "55 5556 7678", "(55) 5556-7678", "+52 55 5556 7678".
 */
export function normalizarTelefonoMx(
  telefono: string | null | undefined
): string | null {
  if (!telefono) return null;

  // Se conserva solo el numero: espacios, guiones, parentesis y el "+" sobran.
  const digitos = telefono.replace(/\D/g, "");

  // Nacional de 10 digitos: el caso normal en la base.
  if (digitos.length === 10) return `${LADA_MEXICO}${digitos}`;

  // Ya trae la lada de pais.
  if (digitos.length === 12 && digitos.startsWith(LADA_MEXICO)) return digitos;

  // El "1" despues del 52 es el prefijo de movil que Telcel arrastraba; WhatsApp
  // ya no lo quiere, pero sigue apareciendo en agendas viejas.
  if (digitos.length === 13 && digitos.startsWith(`${LADA_MEXICO}1`)) {
    return `${LADA_MEXICO}${digitos.slice(3)}`;
  }

  // Cualquier otra cosa (9 digitos, una extension pegada, un numero de otro
  // pais) no se adivina.
  return null;
}

/**
 * URL para abrir WhatsApp con un mensaje ya escrito.
 *
 * NO envia nada: deja el borrador en el chat y la persona pulsa enviar.
 */
export function urlWhatsApp(telefonoE164: string, mensaje: string): string {
  return `https://wa.me/${telefonoE164}?text=${encodeURIComponent(mensaje)}`;
}
