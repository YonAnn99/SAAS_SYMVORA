/**
 * Traduce lo que responde PhotoRoom a algo que un comerciante pueda accionar.
 *
 * POR QUE NO BASTA CON PASAR EL ERROR TAL CUAL. Quien usa esto esta dando de
 * alta un producto en el mostrador, no depurando una API. "402" no le dice
 * nada, y sobre todo no le dice si el problema es suyo (la foto), del dueño del
 * negocio (se acabaron los creditos) o nuestro (falta configurar la llave). Son
 * tres personas distintas las que tienen que hacer algo.
 *
 * Y LO QUE NUNCA DEBE PASAR: devolver el cuerpo crudo de la respuesta de
 * PhotoRoom al navegador. Puede traer detalles de la cuenta, identificadores
 * internos o pistas sobre la llave, y nada de eso tiene por que salir de
 * nuestro servidor.
 */

export interface ErrorQuitarFondo {
  /** El que devuelve NUESTRA ruta, que no tiene por que ser el de PhotoRoom. */
  status: number;
  mensaje: string;
}

/**
 * Falta la llave en el entorno.
 *
 * Se distingue a proposito de "el servicio fallo": son problemas distintos y se
 * arreglan de forma distinta. Este lo arregla quien despliega, añadiendo
 * `PHOTOROOM_API_KEY`; el otro no lo arregla nadie desde aqui.
 */
export const SIN_LLAVE: ErrorQuitarFondo = {
  status: 503,
  mensaje:
    "La mejora de imágenes no está configurada todavía. Avisa a soporte de SYMVORA.",
};

/** Traduce el codigo HTTP de PhotoRoom. */
export function errorDePhotoroom(status: number): ErrorQuitarFondo {
  switch (status) {
    case 400:
    case 415:
      // Culpa de la foto: es lo unico que el cajero puede cambiar.
      return {
        status: 400,
        mensaje:
          "No se pudo procesar esa foto. Intenta con otra, o guarda el producto con la imagen tal cual.",
      };

    case 401:
    case 403:
      // La llave existe pero no sirve: caducada, revocada o mal copiada. No es
      // culpa de quien esta usando la app, asi que no se le pide nada.
      return {
        status: 503,
        mensaje:
          "La mejora de imágenes no está disponible en este momento. Avisa a soporte de SYMVORA.",
      };

    case 402:
      // Se acabaron los creditos. Esto lo resuelve el dueño del negocio, no el
      // cajero, y conviene que el mensaje lo diga sin tecnicismos.
      return {
        status: 402,
        mensaje:
          "Se agotaron los créditos de mejora de imágenes. El producto se puede guardar con la foto original.",
      };

    case 429:
      return {
        status: 429,
        mensaje: "Demasiadas imágenes seguidas. Espera un momento y vuelve a intentarlo.",
      };

    default:
      // Incluye 5xx y cualquier codigo que PhotoRoom añada mañana. Nunca se
      // filtra el cuerpo de su respuesta.
      return {
        status: 502,
        mensaje:
          "El servicio de mejora de imágenes no respondió. Puedes guardar el producto con la foto original.",
      };
  }
}

/** Cuando ni siquiera se llego a hablar con PhotoRoom (red caida, timeout). */
export const SIN_RESPUESTA: ErrorQuitarFondo = {
  status: 504,
  mensaje:
    "La mejora de imágenes tardó demasiado. Puedes guardar el producto con la foto original.",
};
