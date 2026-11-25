/**
 * Cambio de nivel de quien YA paga (Suscripción → «Cambiar de plan»). Lógica pura, sin I/O ni SDK de Conekta:
 * la comparten la ruta `POST /api/conekta/cambiar-plan` y la pantalla, y se prueba sin tocar dinero.
 *
 * Reglas (decisión del dueño, 2026-11-24):
 *  - SUBIR de nivel: el nivel cambia YA; el nuevo precio rige desde el siguiente cobro (sin prorrateo).
 *  - BAJAR de nivel: el precio nuevo rige desde el siguiente cobro y el nivel baja EN ese cobro
 *    (`nivel_pendiente`, que el webhook ya confirma). Antes se comprueba que sus sucursales quepan.
 *  - Sin promo al cambiar: el −50 % es solo para suscripciones nuevas.
 *  - Solo autoservicio con tarjeta mensual o con pagos únicos; lo anual va por soporte.
 */

import { NIVELES_ORDEN, precioNivelCents, type Nivel } from "@/lib/niveles";
import type { BillingPeriod } from "@/lib/pricing";

export type TipoDeCambio = "sube" | "baja" | "igual";

/** Sube, baja o es el mismo. `actual` null (heredado: todo permitido) cuenta como Premium para no «subirlo» a nada. */
export function tipoDeCambio(actual: Nivel | null, nuevo: Nivel): TipoDeCambio {
  const rango = (n: Nivel | null) => (n === null ? NIVELES_ORDEN.length - 1 : NIVELES_ORDEN.indexOf(n));
  const a = rango(actual);
  const b = NIVELES_ORDEN.indexOf(nuevo);
  if (a === b) return actual === null && nuevo !== "premium" ? "baja" : "igual";
  return b > a ? "sube" : "baja";
}

export type ModoDeCambio =
  /** Suscripción recurrente de Conekta, mensual: se cambia el plan en Conekta. */
  | "tarjeta"
  /** Paga con pagos únicos (efectivo, SPEI…): no hay plan que cambiar; el nivel espera a su siguiente pago. */
  | "pago_unico"
  /** Anual u otro caso: lo hace soporte. */
  | "soporte";

export function modoDeCambio(opts: {
  periodo: BillingPeriod;
  tieneSuscripcionRecurrente: boolean;
}): ModoDeCambio {
  if (opts.periodo !== "monthly") return "soporte";
  return opts.tieneSuscripcionRecurrente ? "tarjeta" : "pago_unico";
}

/** Lo que pagará desde su próximo cobro, en pesos (precio de lista: el cambio no lleva promoción). */
export function precioDesdeProximoCobroMXN(nuevo: Nivel, periodo: BillingPeriod): number {
  return precioNivelCents(nuevo, periodo) / 100;
}

/** ¿El nivel cambia ya (sube) o espera al siguiente cobro (baja)? */
export function nivelCambiaAhora(tipo: TipoDeCambio): boolean {
  return tipo === "sube";
}
