/**
 * Constantes del producto que se inyectan en los textos traducidos.
 *
 * POR QUE EXISTE ESTO. La duracion de la prueba aparece en una docena de
 * cadenas de la landing, los correos y el tour. La primera version dejaba el
 * `{dias}` como parametro de ICU y obligaba a cada sitio que renderizara la
 * cadena a pasar `{ dias: DIAS_PRUEBA }`. Basto con que una clave se consumiera
 * desde DOS sitios —la seccion de preguntas y, aparte, los datos estructurados
 * de SEO de la misma pagina— para que uno se olvidara y la landing reventara
 * con `FORMATTING_ERROR: The intl string context variable "dias" was not
 * provided`.
 *
 * El parametro no aporta nada aqui: `dias` no depende de quien llame ni de la
 * pantalla, es una constante del producto. Asi que se rellena UNA VEZ al cargar
 * los mensajes, antes de que next-intl los vea. A partir de ahi ningun sitio
 * tiene que acordarse de nada y el fallo es imposible, no solo improbable.
 *
 * (En next-intl 3 esto lo cubria `defaultTranslationValues`, pero la opcion
 * desaparecio en la 4, que es la que usa el proyecto.)
 *
 * No confundir con los parametros de verdad —`billing.trialEndsIn` usa
 * `{days}` con el numero que queda en ESA suscripcion—, que siguen pasandose
 * en la llamada como debe ser.
 */

import { DIAS_PRUEBA } from "@/lib/trial";

/** Marcadores que se sustituyen, y su valor. */
const CONSTANTES: Record<string, string> = {
  dias: String(DIAS_PRUEBA),
};

const MARCADOR = /\{(\w+)\}/g;

/**
 * Devuelve los mensajes con las constantes ya puestas.
 *
 * Solo toca los marcadores que conoce: cualquier otro (`{days}`, `{count}`,
 * `{name}`...) se deja intacto para que lo resuelva next-intl en la llamada.
 */
export function aplicarConstantes<T>(mensajes: T): T {
  if (typeof mensajes === "string") {
    return mensajes.replace(MARCADOR, (completo, nombre: string) =>
      nombre in CONSTANTES ? CONSTANTES[nombre] : completo
    ) as T;
  }
  if (Array.isArray(mensajes)) {
    return mensajes.map((v) => aplicarConstantes(v)) as T;
  }
  if (mensajes && typeof mensajes === "object") {
    return Object.fromEntries(
      Object.entries(mensajes as Record<string, unknown>).map(([k, v]) => [
        k,
        aplicarConstantes(v),
      ])
    ) as T;
  }
  return mensajes;
}
