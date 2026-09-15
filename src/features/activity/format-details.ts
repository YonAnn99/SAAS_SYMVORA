/**
 * Normaliza el campo `details` de la bitácora antes de pintarlo.
 *
 * POR QUE EXISTE: `activity_logs.details` es jsonb, pero no todo lo guardado
 * es un objeto. Durante un tiempo el cliente mandaba el detalle ya serializado
 * con `JSON.stringify` a un parámetro jsonb, y supabase-js volvía a
 * serializarlo, así que Postgres almacenaba un ESCALAR STRING de JSON:
 * `"{\"fondo_inicial\":300}"` en vez de `{"fondo_inicial": 300}`.
 *
 * La pantalla hacía `Object.entries()` sobre eso y, como en JavaScript
 * `Object.entries("abc")` devuelve `[["0","a"],["1","b"],["2","c"]]`, la
 * columna salía como `0: { 1: " 2: f 3: o …`.
 *
 * El origen está corregido y las filas viejas reparadas, pero la guarda se
 * queda: un dato inesperado debe degradar a algo legible, no deformar la fila.
 */

/** Claves internas del trigger que no aportan nada al lector. */
const CLAVES_INTERNAS = new Set(["operation", "table"]);

export type DetalleNormalizado =
  | { tipo: "vacio" }
  | { tipo: "texto"; texto: string }
  | { tipo: "pares"; pares: Array<{ clave: string; etiqueta: string; valor: string }> };

/** "fondo_inicial" -> "Fondo Inicial" */
export function etiquetaDeClave(clave: string): string {
  return clave.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function valorLegible(valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (valor === null || valor === undefined) return "-";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export function normalizarDetalles(details: unknown): DetalleNormalizado {
  if (details === null || details === undefined) return { tipo: "vacio" };

  let dato = details;

  // Una cadena puede ser JSON doblemente encodeado. Se intenta parsear UNA vez;
  // si sale un objeto, se usa. Lo que no se hace nunca es recorrerla con
  // Object.entries, que es lo que producía la ristra de índices.
  if (typeof dato === "string") {
    const texto = dato.trim();
    if (!texto) return { tipo: "vacio" };
    try {
      const parseado: unknown = JSON.parse(texto);
      if (parseado && typeof parseado === "object" && !Array.isArray(parseado)) {
        dato = parseado;
      } else {
        // JSON válido pero no un objeto (un número, un array, otra cadena):
        // se muestra tal cual, que es más útil que descomponerlo.
        return { tipo: "texto", texto };
      }
    } catch {
      // Ni siquiera es JSON: texto plano.
      return { tipo: "texto", texto };
    }
  }

  if (typeof dato !== "object" || dato === null) {
    return { tipo: "texto", texto: String(dato) };
  }

  if (Array.isArray(dato)) {
    return { tipo: "texto", texto: JSON.stringify(dato) };
  }

  const pares = Object.entries(dato as Record<string, unknown>)
    .filter(([clave]) => !CLAVES_INTERNAS.has(clave))
    .map(([clave, valor]) => ({
      clave,
      etiqueta: etiquetaDeClave(clave),
      valor: valorLegible(valor),
    }));

  return pares.length === 0 ? { tipo: "vacio" } : { tipo: "pares", pares };
}
