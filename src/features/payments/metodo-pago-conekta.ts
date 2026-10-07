/**
 * Metodos de pago de la suscripcion en Conekta.
 *
 * - Tarjeta: SUSCRIPCION (cobro automatico cada periodo). Conekta solo cobra
 *   suscripciones con tarjeta, asi que ese checkout siempre es solo tarjeta.
 * - "unico" ("Otros metodos de pago"): una orden de una sola exhibicion con
 *   todo lo demas que el negocio tenga activo en Conekta. No se renueva sola.
 */

/** Los valores del enum `payment_method` de la base. */
export const METODOS_DE_PAGO = [
  "card",
  "oxxo",
  "manual",
  "cash",
  "bank_transfer",
  "pay_by_bank",
  "spei",
  "apple",
  "google",
  "bnpl",
] as const;

export type MetodoDePago = (typeof METODOS_DE_PAGO)[number];

/** Lo que cada boton de /billing permite en el checkout de Conekta. */
export const METODOS_POR_TIPO: Record<string, string[]> = {
  card: ["card", "apple", "google"],
  // Pago unico: efectivo en tienda, SPEI, Pago Directo BBVA y Aplazo.
  unico: ["cash", "bank_transfer", "pay_by_bank", "bnpl"],
  // Compatibilidad con pestañas abiertas antes de "unico".
  cash: ["cash"],
  bank_transfer: ["bank_transfer", "pay_by_bank"],
};

/** Metodo con el que se registra el pago "pendiente" al generar la orden. */
export function metodoPendiente(tipo: string | undefined): MetodoDePago {
  return tipo === "bank_transfer" ? "bank_transfer" : "cash";
}

/**
 * El `payment_method.type` del cargo, llevado al enum de la base. Un tipo que
 * Conekta agregue despues no puede romper el registro del pago (el `update`
 * fallaria y el pago se quedaria "pendiente" aunque la cuenta se active).
 */
export function metodoDePagoConekta(tipo: unknown): MetodoDePago {
  if (typeof tipo !== "string" || !tipo.trim()) return "card";
  const t = tipo.trim().toLowerCase();
  if ((METODOS_DE_PAGO as readonly string[]).includes(t)) return t as MetodoDePago;
  // Un cargo con tarjeta trae `type` "credit" o "debit".
  if (t === "credit" || t === "debit" || t.includes("card") || t === "default") return "card";
  if (t.includes("oxxo") || t.includes("cash")) return "cash";
  if (t.includes("spei")) return "spei";
  if (t.includes("bnpl") || t.includes("aplazo")) return "bnpl";
  if (t.includes("bank")) return "bank_transfer";
  return "manual";
}
