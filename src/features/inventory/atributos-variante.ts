/**
 * Atributos de las variantes (Color, Talla, Sabor, Voltaje...): catalogo de
 * tipos con sus sugerencias, recomendados por giro y las reglas para pasar de
 * atributos a variantes. Puro: sin React ni Supabase, para poder probarlo.
 *
 * Una variante guarda `atributos: [{tipo, valor}]` (migracion 097) y ademas
 * `talla`/`color` como RESUMEN COMPATIBLE (`resumenCompatible`): asi todo lo
 * que ya lee esas columnas (POS, ticket, compras, traspasos...) sigue
 * mostrandola bien sin cambios.
 */

export interface Atributo {
  tipo: string;
  valor: string;
}

/** Un atributo con varios valores, como se captura al crear (Color: rojo, azul). */
export interface AtributoMultiple {
  tipo: string;
  valores: string[];
}

export const TIPO_COLOR = "Color";
export const TIPO_PERSONALIZADO = "Personalizado";

export const TIPOS_ATRIBUTO: { tipo: string; sugerencias: string[] }[] = [
  { tipo: "Talla", sugerencias: ["XS", "S", "M", "L", "XL", "XXL"] },
  { tipo: TIPO_COLOR, sugerencias: [] }, // las sugerencias son las muestras de COLORES
  { tipo: "Tamaño", sugerencias: ["Chico", "Mediano", "Grande"] },
  { tipo: "Peso", sugerencias: ["100 g", "250 g", "500 g", "1 kg"] },
  { tipo: "Sabor", sugerencias: ["Natural", "Fresa", "Chocolate", "Vainilla", "Limón"] },
  { tipo: "Presentación", sugerencias: ["Pieza", "Paquete", "Caja", "Botella", "Lata"] },
  { tipo: "Capacidad", sugerencias: ["250 ml", "500 ml", "600 ml", "1 L", "2 L", "2.5 L", "3 L"] },
  { tipo: "Medida", sugerencias: ['1/4"', '1/2"', '3/4"', '1"', "1 m", "2 m"] },
  { tipo: "Material", sugerencias: ["Algodón", "Piel", "Plástico", "Metal", "Madera"] },
  { tipo: "Voltaje", sugerencias: ["127 V", "220 V"] },
  { tipo: TIPO_PERSONALIZADO, sugerencias: [] },
];

/** Recomendados por `tenants.giro_comercial` (las 7 configuraciones de registro). */
const POR_GIRO: Record<string, string[]> = {
  ROPA: ["Talla", TIPO_COLOR, "Material"],
  ABARROTES: ["Presentación", "Sabor", "Tamaño"],
  FERRETERIA: ["Medida", "Material", "Voltaje"],
  FARMACIA: ["Presentación", "Tamaño"],
  MASCOTAS: ["Tamaño", "Peso", "Sabor"],
  VERDULERIA: ["Tamaño", "Peso"],
  GENERAL: ["Tamaño", TIPO_COLOR, "Material"],
};

export function sugerenciasDe(tipo: string): string[] {
  return TIPOS_ATRIBUTO.find((t) => t.tipo === tipo)?.sugerencias ?? [];
}

/**
 * Tipos en el orden en que se ofrecen: primero los que YA usan las variantes
 * del producto (para que las nuevas sean consistentes), luego los del giro, el
 * resto despues y "Personalizado" al final. Sin repetidos.
 */
export function tiposSugeridos(configGiro: string | null | undefined, delProducto: string[] = []): string[] {
  const orden: string[] = [];
  const agregar = (t: string) => {
    if (t && t !== TIPO_PERSONALIZADO && !orden.includes(t)) orden.push(t);
  };
  delProducto.forEach(agregar);
  (POR_GIRO[configGiro ?? ""] ?? POR_GIRO.GENERAL).forEach(agregar);
  TIPOS_ATRIBUTO.forEach((t) => agregar(t.tipo));
  orden.push(TIPO_PERSONALIZADO);
  return orden;
}

// --- Colores --------------------------------------------------------------------

export const COLORES: { nombre: string; hex: string }[] = [
  { nombre: "Negro", hex: "#111111" },
  { nombre: "Blanco", hex: "#FFFFFF" },
  { nombre: "Gris", hex: "#9CA3AF" },
  { nombre: "Rojo", hex: "#DC2626" },
  { nombre: "Azul", hex: "#2563EB" },
  { nombre: "Verde", hex: "#16A34A" },
  { nombre: "Amarillo", hex: "#FACC15" },
  { nombre: "Naranja", hex: "#F97316" },
  { nombre: "Rosa", hex: "#EC4899" },
  { nombre: "Morado", hex: "#9333EA" },
  { nombre: "Café", hex: "#8B5A2B" },
  { nombre: "Beige", hex: "#E8D9B5" },
  { nombre: "Dorado", hex: "#D4AF37" },
  { nombre: "Plateado", hex: "#C0C0C0" },
];

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Hex de un nombre de color ("rojo", "Café", "cafe"); `null` si no se conoce. */
export function hexDeColor(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const buscado = sinAcentos(nombre);
  return COLORES.find((c) => sinAcentos(c.nombre) === buscado)?.hex ?? null;
}

// --- De atributos a variantes ------------------------------------------------------

/** Normaliza un valor capturado: sin espacios de mas, primera letra en mayuscula. */
export function normalizarValor(valor: string): string {
  const limpio = valor.replace(/\s+/g, " ").trim();
  return limpio ? limpio.charAt(0).toLocaleUpperCase("es-MX") + limpio.slice(1) : "";
}

/**
 * Todas las combinaciones de los valores, en orden (el primer atributo cambia
 * mas lento). Los atributos sin tipo o sin valores se ignoran.
 */
export function combinaciones(atributos: AtributoMultiple[]): Atributo[][] {
  const validos = atributos.filter((a) => a.tipo.trim() && a.valores.length > 0);
  if (validos.length === 0) return [];
  return validos.reduce<Atributo[][]>(
    (acum, a) => acum.flatMap((combo) => a.valores.map((valor) => [...combo, { tipo: a.tipo, valor }])),
    [[]]
  );
}

/**
 * `talla`/`color` a partir de los atributos: `color` = el atributo Color;
 * `talla` = los demas valores unidos con " · ". Asi se ve igual en todo lo que
 * ya lee esas columnas.
 */
export function resumenCompatible(atributos: Atributo[]): { talla: string | null; color: string | null } {
  const color = atributos.find((a) => a.tipo === TIPO_COLOR)?.valor.trim() || null;
  const resto = atributos
    .filter((a) => a.tipo !== TIPO_COLOR)
    .map((a) => a.valor.trim())
    .filter(Boolean);
  return { talla: resto.length ? resto.join(" · ") : null, color };
}

/** Atributos de una variante; las anteriores a la 097 se leen de talla/color. */
export function atributosDeVariante(v: {
  atributos?: Atributo[] | null;
  talla?: string | null;
  color?: string | null;
}): Atributo[] {
  if (Array.isArray(v.atributos) && v.atributos.length > 0) return v.atributos;
  const lista: Atributo[] = [];
  if (v.talla?.trim()) lista.push({ tipo: "Talla", valor: v.talla.trim() });
  if (v.color?.trim()) lista.push({ tipo: TIPO_COLOR, valor: v.color.trim() });
  return lista;
}

/** "Fresa · 1 L · Rojo": el nombre corto de la variante. */
export function etiquetaAtributos(v: {
  atributos?: Atributo[] | null;
  talla?: string | null;
  color?: string | null;
}): string {
  return atributosDeVariante(v)
    .map((a) => a.valor)
    .join(" · ");
}

/** SKU de una combinacion: base + 3 letras de cada valor ("PLAY-ROJ-M"). */
export function skuDeCombinacion(base: string, valores: string[]): string {
  const sufijo = valores
    .map((v) =>
      sinAcentos(v)
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase()
    )
    .filter(Boolean)
    .join("-");
  const raiz = base.trim().toUpperCase() || "VAR";
  return sufijo ? `${raiz}-${sufijo}` : raiz;
}
