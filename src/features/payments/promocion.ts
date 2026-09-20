/**
 * Promocion de lanzamiento: -50% sobre la mensualidad los primeros 3 cobros.
 *
 * Logica pura, sin I/O y sin tocar el SDK de Conekta a proposito: importar
 * `conekta/config.ts` instancia el SDK nada mas cargarlo, y estas reglas las
 * necesitan tambien la landing publica y `/billing`. Por eso este modulo habla
 * de CLAVES de plan (`"monthlyPromo"`) y no de ids de Conekta; el mapeo a
 * `symvora-basic-monthly-promo50-v1` vive en la capa de Conekta.
 *
 * DOS PREGUNTAS DISTINTAS, Y CONFUNDIRLAS ES EL FALLO CARO:
 *
 *   - "?le toca promocion a quien se suscribe AHORA?"  -> mira `activa`.
 *   - "?cuanto se le cobra a ESTA suscripcion?"        -> mira su contador.
 *
 * Quien ya esta dentro de la promocion conserva sus cobros restantes aunque el
 * dueno apague la oferta: el contador vive en la base
 * (`subscriptions.promo_cobros_restantes`). Si el precio dependiera de
 * `activa`, apagar la promocion le subiria el recibo a mitad de trato a todo
 * el que estuviera en su mes 2.
 */

import {
  PROMO_LANZAMIENTO,
  SUBSCRIPTION_PRICE_CENTS,
  type BillingPeriod,
} from "@/lib/pricing";

/** Clave de plan, no id de Conekta. La traduce `conekta/config.ts`. */
export type ClavePlan = "monthly" | "yearly" | "monthlyPromo";

/** ?Se le ofrece la promocion a quien contrata en este momento? */
export function promoAplica(period: BillingPeriod): boolean {
  return PROMO_LANZAMIENTO.activa && period === PROMO_LANZAMIENTO.periodo;
}

/**
 * Cobros promocionales con los que nace una suscripcion nueva: 3 si le toca
 * promocion, 0 si no. Es lo unico que consulta `activa`.
 */
export function cobrosPromoIniciales(period: BillingPeriod): number {
  return promoAplica(period) ? PROMO_LANZAMIENTO.cobros : 0;
}

/**
 * Lo que hay que cobrar a una suscripcion concreta, en centavos.
 *
 * Deliberadamente NO mira `activa`: manda el contador de la suscripcion. Ver
 * la nota de arriba.
 */
export function precioCobroCents(
  period: BillingPeriod,
  cobrosRestantes: number
): number {
  if (period === PROMO_LANZAMIENTO.periodo && cobrosRestantes > 0) {
    return PROMO_LANZAMIENTO.precioCents;
  }
  return SUBSCRIPTION_PRICE_CENTS[period];
}

/** Plan con el que arrancar un checkout nuevo. */
export function claveDePlanNuevo(period: BillingPeriod): ClavePlan {
  return promoAplica(period) ? "monthlyPromo" : period;
}

/**
 * Efecto de un cobro sobre el contador.
 *
 * `huboCobroReal` es falso cuando el mes se regalo con un credito de referido:
 * ese cargo se reembolsa entero, asi que el cliente no pago y seria quitarle
 * un mes de promocion por usar su credito.
 *
 * `debeVolverAlPlanNormal` es verdadero UNA sola vez, en el cobro que agota el
 * contador. En los siguientes ya vale 0 y no se vuelve a pedir el cambio de
 * plan a Conekta, que no es idempotente ni gratis.
 */
export function trasCobrar(
  cobrosRestantes: number,
  huboCobroReal: boolean
): { restantes: number; debeVolverAlPlanNormal: boolean } {
  if (!huboCobroReal || cobrosRestantes <= 0) {
    return {
      restantes: Math.max(0, cobrosRestantes),
      debeVolverAlPlanNormal: false,
    };
  }
  const restantes = cobrosRestantes - 1;
  return { restantes, debeVolverAlPlanNormal: restantes === 0 };
}

/** Precio de lista, para tacharlo junto al promocional. */
export function precioListaMXN(period: BillingPeriod): number {
  return SUBSCRIPTION_PRICE_CENTS[period] / 100;
}

/** Precio promocional en pesos, para la UI. */
export const PRECIO_PROMO_MXN = PROMO_LANZAMIENTO.precioCents / 100;
