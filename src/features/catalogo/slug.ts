import { getSiteUrl } from "@/lib/site";

/**
 * El enlace del catálogo: www.symvora.com.mx/es/catalogo/<slug>.
 *
 * Mismas reglas que el CHECK de `catalogos_en_linea` (migración 124): de 3 a
 * 40 caracteres, minúsculas, números y guiones sueltos entre palabras. Si
 * cambia una, cambia la otra.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const PATRON_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugValido(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && PATRON_SLUG.test(slug);
}

/**
 * "Autopartes Carrillo & Hijos" → "autopartes-carrillo-hijos". Quita acentos y
 * símbolos; lo que no es letra o número se vuelve un guion. Puede quedar corto
 * (o vacío) con un nombre raro: `slugValido` decide.
 */
export function slugDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, SLUG_MAX).replace(/-+$/, "");
}

/**
 * Lo que se va tecleando en el campo del enlace, ya limpio: el negocio puede
 * escribir "Mi Tienda" y ve "mi-tienda". Conserva un guion final mientras
 * escribe (para poder seguir con otra palabra).
 */
export function limpiarSlugTecleado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX);
}

/** "mi-tienda" ocupado → "mi-tienda-2", "mi-tienda-3"… sin pasar de 40. */
export function slugConSufijo(slug: string, n: number): string {
  const sufijo = `-${n}`;
  return `${slug.slice(0, SLUG_MAX - sufijo.length).replace(/-+$/, "")}${sufijo}`;
}

export function urlCatalogo(slug: string, locale = "es", base = getSiteUrl()): string {
  return `${base.replace(/\/$/, "")}/${locale === "en" ? "en" : "es"}/catalogo/${slug}`;
}
