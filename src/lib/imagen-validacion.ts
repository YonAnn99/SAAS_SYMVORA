/**
 * Que imagenes se admiten al elegir un archivo, y por que se rechaza una.
 *
 * POR QUE VIVE FUERA DEL COMPONENTE. Estaba embebida en `FileUpload` y sin un
 * solo test, pese a ser lo unico con reglas de negocio de esa pantalla. Y esas
 * reglas dejaron de ser una sola en cuanto se pudo tomar la foto con la camara:
 * el limite y los formatos de una foto de producto no son los de un logo.
 *
 * LOS DOS FALLOS QUE ESTO ARREGLA, y que hacian imposible la camara:
 *
 *  1. EL LIMITE SE MEDIA SOBRE EL ARCHIVO CRUDO. El tope de 2 MB se comprobaba
 *     antes de convertir, y la conversion a 800x800 webp ocurre mucho despues,
 *     al guardar. Una foto de celular pesa entre 3 y 8 MB, asi que TODA foto
 *     tomada con la camara se rechazaba con "El archivo excede 2MB" aunque el
 *     webp final pesara 100 KB. Por eso el limite es ahora un parametro: en
 *     productos se deja holgado, porque el tope real lo garantiza la conversion.
 *
 *  2. EL IPHONE ENTREGA HEIC. Con "Alta eficiencia" —el ajuste por defecto— la
 *     foto llega como `image/heic` y salia "Formato no valido". Safari sabe
 *     decodificar HEIC en canvas, asi que la conversion a webp funciona: lo
 *     unico que sobraba era el veto.
 */

/** Lo que se sube siempre acaba en webp, asi que el tope del bucket no se toca. */
export const MB = 1024 * 1024;

export interface OpcionesImagen {
  maxSizeMB: number;
  tiposAceptados: readonly string[];
}

/**
 * Logos del negocio: se suben tal cual, sin recortar ni escalar
 * (`convertToWebP` conserva las dimensiones), asi que el limite de entrada SI
 * es el limite de salida y tiene que seguir siendo estrecho.
 */
export const IMAGEN_LOGO: OpcionesImagen = {
  maxSizeMB: 2,
  tiposAceptados: ["image/jpeg", "image/png", "image/svg+xml"],
};

/**
 * Foto de producto: entra lo que dé el celular y sale un webp de 800x800.
 *
 * Sin SVG a proposito: el bucket `product-images` no lo lista en sus
 * `allowed_mime_types` (migracion 045), asi que aceptarlo aqui era admitir algo
 * que el servidor habria rechazado.
 */
export const IMAGEN_PRODUCTO: OpcionesImagen = {
  maxSizeMB: 15,
  tiposAceptados: [
    "image/jpeg",
    "image/png",
    "image/webp",
    // Camara de iPhone con "Alta eficiencia". Safari los decodifica en canvas.
    "image/heic",
    "image/heif",
  ],
};

export type MotivoImagenInvalida = "formato" | "tamano";

export interface ResultadoImagen {
  ok: boolean;
  motivo?: MotivoImagenInvalida;
  mensaje?: string;
}

/** Nombres legibles para el mensaje de error, sin el prefijo `image/`. */
function etiquetasDeFormato(tipos: readonly string[]): string {
  const vistos = new Set<string>();
  for (const t of tipos) {
    const nombre = t.replace("image/", "").replace("svg+xml", "svg");
    // HEIC y HEIF son lo mismo para quien lee el mensaje.
    vistos.add(nombre === "heif" ? "heic" : nombre);
  }
  return [...vistos].map((n) => n.toUpperCase()).join(", ");
}

/**
 * Devuelve si el archivo elegido sirve, y si no, por que.
 *
 * El orden importa: primero el formato y luego el tamaño. Un PDF de 40 MB tiene
 * dos problemas, y decir "excede el tamaño" mandaria a comprimir un archivo que
 * nunca iba a servir.
 */
export function validarImagenElegida(
  file: File,
  opciones: OpcionesImagen
): ResultadoImagen {
  if (!opciones.tiposAceptados.includes(file.type)) {
    return {
      ok: false,
      motivo: "formato",
      mensaje: `Formato no válido. Usa ${etiquetasDeFormato(opciones.tiposAceptados)}.`,
    };
  }

  if (file.size > opciones.maxSizeMB * MB) {
    return {
      ok: false,
      motivo: "tamano",
      mensaje: `El archivo excede ${opciones.maxSizeMB}MB.`,
    };
  }

  return { ok: true };
}
