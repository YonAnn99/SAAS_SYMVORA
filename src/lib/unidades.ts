/**
 * Unidades de medida de los productos. FUENTE UNICA del lado de la app: el
 * enum `unidad_medida` de la base (migracion 090) debe tener exactamente estos
 * valores, y los tipos, las validaciones, el selector de producto, la
 * importacion y el POS salen de aqui.
 *
 * Dos familias:
 * - DE MEDIDA (fraccionables): kilo, gramo, litro, mililitro, metro. Se
 *   venden con decimales (0.750 kg, 3.5 m): el POS pide la cantidad.
 * - DE CONTEO: pieza, caja, paquete, par, docena. Siempre enteras.
 * SERVICIO no mueve existencias; se cuenta como pieza.
 *
 * La base guarda hasta 3 decimales (`numeric(…,3)` en ventas, existencias y
 * compras); por eso `normalizarCantidad` redondea a 3.
 */

export const UNIDADES = [
  "PIEZA",
  "KG",
  "GRAMO",
  "LITRO",
  "MILILITRO",
  "METRO",
  "CAJA",
  "PAQUETE",
  "PAR",
  "DOCENA",
  "SERVICIO",
] as const;

export type UnidadMedida = (typeof UNIDADES)[number];

/** Las que se venden con decimales. */
export const UNIDADES_FRACCIONABLES: readonly UnidadMedida[] = [
  "KG",
  "GRAMO",
  "LITRO",
  "MILILITRO",
  "METRO",
];

/** Las que puede tener un producto que SI maneja existencias (todas menos servicio). */
export const UNIDADES_FISICAS: readonly UnidadMedida[] = UNIDADES.filter((u) => u !== "SERVICIO");

export function esUnidad(valor: unknown): valor is UnidadMedida {
  return typeof valor === "string" && (UNIDADES as readonly string[]).includes(valor);
}

export function esFraccionable(unidad: string | null | undefined): boolean {
  return Boolean(unidad) && UNIDADES_FRACCIONABLES.includes(unidad as UnidadMedida);
}

/** Abreviatura para cantidades: singular y plural. */
const ABREVIATURA: Record<UnidadMedida, [string, string]> = {
  PIEZA: ["pza", "pzas"],
  KG: ["kg", "kg"],
  GRAMO: ["g", "g"],
  LITRO: ["l", "l"],
  MILILITRO: ["ml", "ml"],
  METRO: ["m", "m"],
  CAJA: ["caja", "cajas"],
  PAQUETE: ["paq", "paqs"],
  PAR: ["par", "pares"],
  DOCENA: ["doc", "docs"],
  SERVICIO: ["serv", "serv"],
};

export function abreviatura(unidad: string | null | undefined, cantidad = 2): string {
  const par = esUnidad(unidad) ? ABREVIATURA[unidad] : ABREVIATURA.PIEZA;
  return cantidad === 1 ? par[0] : par[1];
}

/**
 * "0.75 kg", "3.5 m", "1 pza", "2 pares". Sin ceros de relleno: 0.750 se
 * muestra 0.75 y 2.000 se muestra 2.
 */
export function formatearCantidad(cantidad: number, unidad: string | null | undefined): string {
  const numero = Number.isInteger(cantidad)
    ? String(cantidad)
    : String(Math.round(cantidad * 1000) / 1000);
  return `${numero} ${abreviatura(unidad, cantidad)}`;
}

/**
 * Convierte lo que se teclea en una cantidad valida para esa unidad, o `null`.
 * Fraccionables: mayor que 0, hasta 3 decimales (se redondea). De conteo:
 * entero de 1 en adelante. Acepta coma decimal ("0,75").
 */
export function normalizarCantidad(
  valor: string | number,
  unidad: string | null | undefined
): number | null {
  const texto = typeof valor === "number" ? String(valor) : valor.trim().replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(texto)) return null;
  const n = Number(texto);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (esFraccionable(unidad)) {
    const redondeada = Math.round(n * 1000) / 1000;
    return redondeada > 0 ? redondeada : null;
  }
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Cuantos ARTICULOS aporta una linea al conteo del carrito y del ticket.
 * Por medida es 1 (0.750 kg de jitomate es un articulo, no 0.75); de conteo,
 * la cantidad (3 refrescos son 3 articulos).
 */
export function articulosDeLinea(cantidad: number, unidad: string | null | undefined): number {
  return esFraccionable(unidad) ? 1 : cantidad;
}

/** Clave de unidad del SAT (CFDI) para cada unidad. */
export const CLAVE_SAT: Record<UnidadMedida, string> = {
  PIEZA: "H87",
  KG: "KGM",
  GRAMO: "GRM",
  LITRO: "LTR",
  MILILITRO: "MLT",
  METRO: "MTR",
  CAJA: "XBX",
  PAQUETE: "XPK",
  PAR: "PR",
  DOCENA: "DZN",
  SERVICIO: "E48",
};
