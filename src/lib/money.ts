/**
 * Formato de dinero. Fuente única de cómo se pinta un monto.
 *
 * Cada negocio elige su moneda (`tenants.moneda`, migración 133): MXN por
 * defecto, USD o EUR. Es SOLO formato: los precios y ventas guardados son
 * números y no se convierten al cambiarla.
 *
 * Cada moneda usa el formato de su país, no el idioma de la interfaz: un
 * negocio en euros ve «1234,50 €» aunque tenga el panel en inglés.
 *
 * La suscripción de SYMVORA (`/billing`, `lib/pricing.ts`) se cobra en pesos
 * siempre: usa `formatMXN`.
 */

export const MONEDAS = ["MXN", "USD", "EUR"] as const;
export type Moneda = (typeof MONEDAS)[number];
export const MONEDA_POR_DEFECTO: Moneda = "MXN";

const LOCALE_DE: Record<Moneda, string> = {
  MXN: "es-MX",
  USD: "en-US",
  EUR: "es-ES",
};

export function esMoneda(valor: unknown): valor is Moneda {
  return typeof valor === "string" && (MONEDAS as readonly string[]).includes(valor);
}

/** La moneda guardada, o MXN si falta o no se reconoce (respuesta vieja). */
export function monedaDe(valor: unknown): Moneda {
  return esMoneda(valor) ? valor : MONEDA_POR_DEFECTO;
}

const completos = new Map<Moneda, Intl.NumberFormat>();
const compactos = new Map<Moneda, Intl.NumberFormat>();

/** "$1,234.50" (MXN y USD) o "1234,50 €" (EUR). */
export function formatMoneda(n: number, moneda: Moneda = MONEDA_POR_DEFECTO): string {
  let f = completos.get(moneda);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_DE[moneda], { style: "currency", currency: moneda });
    completos.set(moneda, f);
  }
  return f.format(Number(n));
}

/** Corto para ejes de gráficas: "$1.2 k", "1,2 mil €". */
export function formatMonedaCompacto(n: number, moneda: Moneda = MONEDA_POR_DEFECTO): string {
  let f = compactos.get(moneda);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_DE[moneda], {
      style: "currency",
      currency: moneda,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    compactos.set(moneda, f);
  }
  return f.format(Number(n));
}

const enteros = new Map<Moneda, Intl.NumberFormat>();

/** Sin decimales, para billetes y montos redondos: "$200", "50 €". */
export function formatMonedaEntero(n: number, moneda: Moneda = MONEDA_POR_DEFECTO): string {
  let f = enteros.get(moneda);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_DE[moneda], {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    enteros.set(moneda, f);
  }
  return f.format(Number(n));
}

/** "$" o "€". */
export function simboloMoneda(moneda: Moneda = MONEDA_POR_DEFECTO): string {
  return moneda === "EUR" ? "€" : "$";
}

/** Pesos mexicanos: la suscripción de SYMVORA, correos internos y lo que aún no sabe de la moneda. */
export function formatMXN(n: number): string {
  return formatMoneda(n, "MXN");
}
