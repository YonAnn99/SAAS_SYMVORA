/**
 * Nombre de la persona a partir de `user_metadata` de Supabase Auth.
 *
 * El registro con correo y el de Google (completar-registro) lo guardan en
 * `nombre`; Mi perfil lo guardaba antes solo en `nombre_completo`/`full_name`, y
 * Google trae su propio `full_name`. Esta es la unica lectura: el perfil, el
 * saludo del Dashboard y quien lo necesite resuelven el mismo nombre.
 */
type Metadatos = Record<string, unknown> | null | undefined;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Prioridad: lo editado en Mi perfil (`nombre_completo`), lo capturado en el
 * registro (`nombre`) y, al final, lo que manda Google (`full_name`).
 */
export function nombreCompleto(meta: Metadatos): string {
  return (
    texto(meta?.nombre_completo) || texto(meta?.nombre) || texto(meta?.full_name)
  );
}

/**
 * Primera palabra de un nombre completo: el campo "Nombre" del registro, que
 * se guarda como `nombre segundo paterno materno`.
 */
export function primerNombre(completo: string): string {
  return completo.trim().split(/\s+/)[0] ?? "";
}

/** Partes del nombre que se capturan en Mi perfil (el registro solo pide nombre y apellido). */
export interface PartesNombre {
  primerNombre: string;
  segundoNombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

/** Nombre completo a partir de sus partes: las vacias no dejan espacios de mas. */
export function armarNombre(partes: PartesNombre): string {
  return [partes.primerNombre, partes.segundoNombre, partes.apellidoPaterno, partes.apellidoMaterno]
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(" ");
}

/**
 * Valores iniciales del formulario de Mi perfil. Usa las partes guardadas
 * (`primer_nombre`, `segundo_nombre`, `apellido_paterno`, `apellido_materno`)
 * solo si todavia forman el nombre vigente: el dueño puede cambiarlo desde
 * Usuarios, que solo escribe el nombre completo. Si no, parte el nombre por
 * palabras; es una sugerencia que la persona revisa antes de guardar.
 */
export function partesDelNombre(meta: Metadatos): PartesNombre {
  const completo = nombreCompleto(meta).replace(/\s+/g, " ");
  const guardadas: PartesNombre = {
    primerNombre: texto(meta?.primer_nombre),
    segundoNombre: texto(meta?.segundo_nombre),
    apellidoPaterno: texto(meta?.apellido_paterno),
    apellidoMaterno: texto(meta?.apellido_materno),
  };
  if (guardadas.primerNombre && armarNombre(guardadas) === completo) return guardadas;

  const palabras = completo ? completo.split(" ") : [];
  const vacio = { primerNombre: "", segundoNombre: "", apellidoPaterno: "", apellidoMaterno: "" };
  switch (palabras.length) {
    case 0:
      return vacio;
    case 1:
      return { ...vacio, primerNombre: palabras[0] };
    case 2:
      return { ...vacio, primerNombre: palabras[0], apellidoPaterno: palabras[1] };
    case 3:
      return { ...vacio, primerNombre: palabras[0], apellidoPaterno: palabras[1], apellidoMaterno: palabras[2] };
    default:
      return {
        primerNombre: palabras[0],
        segundoNombre: palabras.slice(1, -2).join(" "),
        apellidoPaterno: palabras[palabras.length - 2],
        apellidoMaterno: palabras[palabras.length - 1],
      };
  }
}

/** Edad permitida en Mi perfil: los Terminos exigen ser mayor de edad. */
export const EDAD_MINIMA = 18;
export const EDAD_MAXIMA = 120;

export function edadValida(edad: number): boolean {
  return Number.isInteger(edad) && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA;
}

/** Edad guardada en `user_metadata.edad` (opcional), o `null`. */
export function edadDe(meta: Metadatos): number | null {
  const valor = meta?.edad;
  const edad = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  return edadValida(edad) ? edad : null;
}
