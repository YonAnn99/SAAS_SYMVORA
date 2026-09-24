import { UNIDADES, UNIDADES_FRACCIONABLES, type UnidadMedida } from "@/lib/unidades";

/**
 * Modulos opcionales del negocio (Configuracion -> Modulos), guardados en
 * `tenant_settings.configuracion_json.modulos_activos`.
 *
 * Hasta el 2026-09-24 los interruptores SOLO se guardaban: no cambiaban nada
 * en el sistema. Ahora cada uno oculta las opciones para USAR esa funcion.
 *
 * REGLA: apagar oculta, NUNCA borra ni rompe lo que ya existe. Un producto que
 * ya se vende por kilo, que ya maneja lotes o que ya tiene variantes sigue
 * funcionando y sigue mostrando su opcion. Solo se deja de OFRECER para lo
 * nuevo. Volver a encenderlo lo trae todo de regreso.
 */

export const CLAVES_MODULO = [
  "permite_granel",
  "permite_variantes",
  "permite_lotes_caducidad",
  "permite_mermas",
  "permite_servicios",
  "permite_credito_fiado",
] as const;

export type ClaveModulo = (typeof CLAVES_MODULO)[number];
export type Modulos = Record<ClaveModulo, boolean>;

/** Nombre y que hace cada uno, para la pantalla de Configuracion. */
export const INFO_MODULO: Record<ClaveModulo, { nombre: string; efecto: string }> = {
  permite_granel: {
    nombre: "Venta por peso o medida",
    efecto: "Unidades kilogramo, gramo, litro, mililitro y metro al crear productos; en el punto de venta se captura la cantidad.",
  },
  permite_variantes: {
    nombre: "Variantes de talla y color",
    efecto: "Pestaña Variantes en Productos y la opción «Maneja variantes» al crear un producto.",
  },
  permite_lotes_caducidad: {
    nombre: "Lotes y caducidades",
    efecto: "Pestaña Lotes en Productos y la opción «Maneja lotes y fecha de caducidad».",
  },
  permite_mermas: {
    nombre: "Mermas",
    efecto: "El motivo «Merma» en los ajustes de inventario.",
  },
  permite_servicios: {
    nombre: "Servicios",
    efecto: "La opción «Es servicio» al crear un producto: se cobra sin descontar existencias.",
  },
  permite_credito_fiado: {
    nombre: "Ventas a crédito / fiado",
    efecto: "El método de pago «Crédito / Fiado» en el punto de venta.",
  },
};

/**
 * Todo encendido: lo que se usa mientras cargan los ajustes o si no se pueden
 * leer. Ante la duda NO se esconde nada: ocultar una opcion que el negocio usa
 * es peor que mostrar una que no usa.
 */
export const TODOS_ENCENDIDOS: Modulos = Object.fromEntries(
  CLAVES_MODULO.map((c) => [c, true])
) as Modulos;

/** Lee lo guardado; lo que falte o no sea booleano cuenta como encendido. */
export function normalizarModulos(json: unknown): Modulos {
  const guardado =
    json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  return Object.fromEntries(
    CLAVES_MODULO.map((c) => [c, typeof guardado[c] === "boolean" ? guardado[c] : true])
  ) as Modulos;
}

/**
 * Modulos con los que nace una cuenta, segun su giro. Son los mismos que la
 * pagina de cada giro en la landing recomienda encender, para que al entrar
 * ya este activo lo que se le prometio. Siempre se pueden cambiar.
 */
export function modulosPorGiro(giro: string): Modulos {
  const base: Modulos = {
    permite_granel: false,
    permite_variantes: false,
    permite_lotes_caducidad: true,
    permite_mermas: true,
    permite_servicios: false,
    permite_credito_fiado: true,
  };
  switch (giro) {
    case "ABARROTES":
    case "VERDULERIA":
    case "FERRETERIA":
      return { ...base, permite_granel: true };
    case "MASCOTAS":
      return { ...base, permite_granel: true, permite_servicios: true, permite_variantes: true };
    case "ROPA":
      return { ...base, permite_variantes: true };
    case "FARMACIA":
      return base;
    default:
      // GENERAL y lo que no se reconozca: todo menos venta por medida. Es la
      // configuracion de giros muy distintos (papeleria, regalos, cosmeticos).
      return { ...base, permite_servicios: true, permite_variantes: true };
  }
}

/**
 * Unidades que se ofrecen al crear o editar un producto.
 * - Sin "venta por peso o medida": fuera kg, g, l, ml y m.
 * - Sin "servicios": fuera SERVICIO.
 * La unidad ACTUAL del producto entra siempre, aunque su modulo este apagado:
 * si no, el selector abriria en blanco y el primer clic se la cambiaria.
 */
export function unidadesOfrecidas(modulos: Modulos, actual?: UnidadMedida | null): UnidadMedida[] {
  const lista = UNIDADES.filter((u) => {
    if (!modulos.permite_granel && UNIDADES_FRACCIONABLES.includes(u)) return false;
    if (!modulos.permite_servicios && u === "SERVICIO") return false;
    return true;
  });
  return actual && !lista.includes(actual) ? [actual, ...lista] : lista;
}

/** Nombre corto de cada modulo en las paginas de giro (`giros.ts`). */
const CLAVE_DE_RECOMENDADO: Record<string, ClaveModulo> = {
  granel: "permite_granel",
  variantes: "permite_variantes",
  lotes: "permite_lotes_caducidad",
  mermas: "permite_mermas",
  servicios: "permite_servicios",
  credito: "permite_credito_fiado",
};

/**
 * Modulos con los que nace una cuenta de un giro concreto: los de su
 * configuracion MAS todos los que recomienda su pagina en la landing. Asi
 * quien se registra como florería encuentra encendidos los servicios que su
 * pagina le prometio, aunque su configuracion sea GENERAL.
 */
export function modulosParaGiro(giro: { config: string; modulos: readonly string[] }): Modulos {
  const modulos = { ...modulosPorGiro(giro.config) };
  for (const recomendado of giro.modulos) {
    const clave = CLAVE_DE_RECOMENDADO[recomendado];
    if (clave) modulos[clave] = true;
  }
  return modulos;
}
