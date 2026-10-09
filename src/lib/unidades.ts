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
 * Sufijo para etiquetas de precio y costo: " por kg" en las de medida (el
 * precio se captura POR UNIDAD: $180 = $180 el kilo), "" en las de conteo.
 */
export function porUnidad(unidad: string | null | undefined): string {
  return esFraccionable(unidad) ? ` por ${abreviatura(unidad, 1)}` : "";
}

/** Sufijo para etiquetas de stock: " (kg)" en las de medida, "" en las demas. */
export function enUnidad(unidad: string | null | undefined): string {
  return esFraccionable(unidad) ? ` (${abreviatura(unidad, 1)})` : "";
}

/**
 * Venta por importe ("$50 de jamon"): la cantidad que corresponde a ese monto
 * al precio por unidad, redondeada a 3 decimales como guarda la base. Por eso
 * el importe real puede variar unos centavos ($50 a $180/kg = 0.278 kg =
 * $50.04). `null` si el importe o el precio no son mayores a 0.
 */
export function cantidadPorImporte(
  importe: string | number,
  precioUnitario: number,
  unidad: string | null | undefined
): number | null {
  const monto = typeof importe === "number" ? importe : Number(importe.trim().replace(",", "."));
  if (!Number.isFinite(monto) || monto <= 0 || !(precioUnitario > 0)) return null;
  return normalizarCantidad(Math.round((monto / precioUnitario) * 1000) / 1000, unidad);
}

/**
 * La unidad con la que se vende algo: la de la variante si tiene la suya
 * (migracion 104), si no la del producto. El POS decide con ella si pide la
 * cantidad (granel) o suma piezas.
 */
export function unidadDeVenta<U extends string>(
  producto: { unidad_medida: U },
  variante?: { unidad_medida?: U | null } | null
): U {
  return variante?.unidad_medida ?? producto.unidad_medida;
}

/**
 * Cuantos ARTICULOS aporta una linea al conteo del carrito y del ticket.
 * Por medida es 1 (0.750 kg de jitomate es un articulo, no 0.75); de conteo,
 * la cantidad (3 refrescos son 3 articulos).
 */
export function articulosDeLinea(cantidad: number, unidad: string | null | undefined): number {
  return esFraccionable(unidad) ? 1 : cantidad;
}

// ---------------------------------------------------------------------------
// Contenido del envase (migracion 114)
// ---------------------------------------------------------------------------
//
// Lo que TRAE un producto empaquetado (Coca Cola 2.5 L, Sabritas 45 g). Es
// solo descriptivo: como se cobra lo decide `unidad_medida`. Antes se usaba la
// unidad para esto y el POS acababa ofreciendo "1/4 l" de un refresco.

/** Medidas validas para el contenido: las de medida, nunca pieza o caja. */
export const UNIDADES_CONTENIDO = UNIDADES_FRACCIONABLES;

/** Abreviatura del contenido tal como viene en las etiquetas: "L" mayuscula. */
const ABREVIATURA_CONTENIDO: Partial<Record<UnidadMedida, string>> = {
  KG: "kg",
  GRAMO: "g",
  LITRO: "L",
  MILILITRO: "ml",
  METRO: "m",
};

export interface Contenido {
  cantidad: number;
  unidad: UnidadMedida;
}

/** "2.5 L", "600 ml", "45 g". Vacio si falta algo o la medida no aplica. */
export function formatearContenido(
  cantidad: number | string | null | undefined,
  unidad: string | null | undefined
): string {
  const n = Number(cantidad);
  if (cantidad == null || !Number.isFinite(n) || n <= 0 || !esUnidad(unidad)) return "";
  const abrev = ABREVIATURA_CONTENIDO[unidad];
  if (!abrev) return "";
  return `${Math.round(n * 1000) / 1000} ${abrev}`;
}

type ConContenido = {
  contenido_cantidad?: number | string | null;
  contenido_unidad?: string | null;
};

/**
 * El contenido de lo que se vende: el de la variante si tiene uno, si no el
 * del producto (misma regla que `unidadDeVenta`). `null` si ninguno lo tiene.
 */
export function contenidoDe(producto: ConContenido, variante?: ConContenido | null): Contenido | null {
  const fuente =
    variante?.contenido_cantidad != null && variante.contenido_unidad ? variante : producto;
  const cantidad = Number(fuente.contenido_cantidad);
  if (fuente.contenido_cantidad == null || !(cantidad > 0)) return null;
  if (!esFraccionable(fuente.contenido_unidad)) return null;
  return { cantidad, unidad: fuente.contenido_unidad as UnidadMedida };
}

/**
 * Texto del contenido para pintarlo junto al nombre ("2.5 L"), con la misma
 * herencia que `contenidoDe`. Vacio si no tiene o si se vende a granel: ahi la
 * medida es la unidad de venta y repetirla confunde.
 */
export function textoContenido(
  producto: ConContenido & { unidad_medida?: string | null },
  variante?: (ConContenido & { unidad_medida?: string | null }) | null
): string {
  const unidad = variante?.unidad_medida ?? producto.unidad_medida;
  if (esFraccionable(unidad)) return "";
  const c = contenidoDe(producto, variante);
  return c ? formatearContenido(c.cantidad, c.unidad) : "";
}

/**
 * Lo capturado en el formulario -> lo que se guarda. Vacio = sin contenido
 * (NULL en las dos columnas); con cantidad, la medida es obligatoria y la
 * cantidad pasa por `normalizarCantidad` (mayor a 0, hasta 3 decimales).
 */
export function contenidoCapturado(
  cantidadTexto: string,
  unidad: string | null | undefined
):
  | { ok: true; contenido_cantidad: number | null; contenido_unidad: UnidadMedida | null }
  | { ok: false; error: string } {
  if (cantidadTexto.trim() === "") {
    return { ok: true, contenido_cantidad: null, contenido_unidad: null };
  }
  if (!esFraccionable(unidad)) {
    return { ok: false, error: "Elige la medida del contenido (ml, L, g, kg o m)" };
  }
  const cantidad = normalizarCantidad(cantidadTexto, unidad);
  if (cantidad == null) {
    return { ok: false, error: "El contenido debe ser un número mayor a 0" };
  }
  return { ok: true, contenido_cantidad: cantidad, contenido_unidad: unidad as UnidadMedida };
}

/** Texto de unidad que se escribe en nombres y atributos -> medida. */
const UNIDAD_EN_TEXTO: [RegExp, UnidadMedida][] = [
  [/^(ml|mililitros?)$/, "MILILITRO"],
  [/^(l|lt|lts|litros?)$/, "LITRO"],
  [/^(kg|kgs|kilos?|kilogramos?)$/, "KG"],
  [/^(g|gr|grs|gramos?)$/, "GRAMO"],
  [/^(m|mts|metros?)$/, "METRO"],
];

const MEDIDA_EN_TEXTO =
  /(\d+(?:[.,]\d+)?)\s*(mililitros?|ml|litros?|lts?|l|kilogramos?|kilos?|kgs?|gramos?|grs?|g|metros?|mts|m)(?![a-záéíóúñ0-9])/i;

/**
 * Lee una medida escrita en un texto: "2.5 L", "600ml", "1,5 litros", "Sabritas
 * 45 g". La primera que encuentre, o `null`. Sirve para sugerir el contenido a
 * partir del nombre o de un atributo de la variante.
 */
export function contenidoDesdeTexto(texto: string | null | undefined): Contenido | null {
  if (!texto) return null;
  const m = texto.match(MEDIDA_EN_TEXTO);
  if (!m) return null;
  const cantidad = Math.round(Number(m[1].replace(",", ".")) * 1000) / 1000;
  if (!(cantidad > 0)) return null;
  const palabra = m[2].toLowerCase();
  const unidad = UNIDAD_EN_TEXTO.find(([re]) => re.test(palabra))?.[1];
  return unidad ? { cantidad, unidad } : null;
}

/**
 * El nombre o algun atributo trae una medida ("Coca Cola 2.5 L"): pinta de
 * producto empaquetado. Si ademas se eligio una unidad a granel, el formulario
 * avisa que probablemente deberia venderse por pieza.
 */
export function pareceEmpaquetado(
  nombre: string | null | undefined,
  atributos: Array<string | { valor?: string | null }> = []
): boolean {
  if (contenidoDesdeTexto(nombre)) return true;
  return atributos.some((a) => contenidoDesdeTexto(typeof a === "string" ? a : a.valor));
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
