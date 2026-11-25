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

import { precioNivelCents, precioPromoNivelCents, promoAplicaANivel, type Nivel } from "@/lib/niveles";
import {
  PROMO_LANZAMIENTO,
  PROMO_ANUAL_TABLET,
  SUBSCRIPTION_PRICE_CENTS,
  esPromoAnualTabletVigente,
  type BillingPeriod,
} from "@/lib/pricing";

/** Clave de plan, no id de Conekta. La traduce `conekta/config.ts`. */
export type ClavePlan =
  | "monthly"
  | "yearly"
  | "monthlyPromo"
  | "yearlyTablet"
  // Niveles de suscripcion (migracion 140): un plan de Conekta por nivel y periodo.
  | "basicoMonthly"
  | "basicoYearly"
  | "proMonthly"
  | "proYearly"
  | "premiumMonthly"
  | "premiumYearly"
  // Promocion de lanzamiento de los niveles: solo Pro y Premium, solo mensual.
  | "proMonthlyPromo"
  | "premiumMonthlyPromo";

/**
 * Plan de Conekta de un nivel. Con `conPromo` y si el nivel lo admite (`promoAplicaANivel`: Pro/Premium
 * mensual), el plan promocional paralelo; si no, el de lista.
 */
export function clavePlanDeNivel(nivel: Nivel, period: BillingPeriod, conPromo: boolean = false): ClavePlan {
  if (conPromo && promoAplicaANivel(nivel, period)) return `${nivel}MonthlyPromo` as ClavePlan;
  const sufijo = period === "yearly" ? "Yearly" : "Monthly";
  return `${nivel}${sufijo}` as ClavePlan;
}

/**
 * Lo que cuesta en centavos un nivel. Sin contador, su precio de lista; con `cobrosPromoRestantes > 0`
 * (mensual, Pro/Premium) el promocional. Igual que `precioCobroCents`, manda el contador de la
 * suscripcion y NO el interruptor `activa`: apagar la oferta no sube el recibo a quien ya la tiene.
 */
export function precioNivelCobroCents(
  nivel: Nivel,
  period: BillingPeriod,
  cobrosPromoRestantes: number = 0
): number {
  if (period === PROMO_LANZAMIENTO.periodo && cobrosPromoRestantes > 0 && nivel !== "basico") {
    return precioPromoNivelCents(nivel);
  }
  return precioNivelCents(nivel, period);
}

/**
 * Precio promocional y precio normal (en pesos) de la promo en curso de una suscripcion, segun el plan
 * promocional que guarda (`subscriptions.promo_plan`). Un plan de nivel (`symvora-pro-monthly-promo50-v1`,
 * `symvora-premium-…`) lleva el precio de su nivel; cualquier otro es la promo del plan unico. Es lo que
 * pinta `/billing` en «te quedan N cobros a $X»: sin esto mostraria $199 a quien tiene Pro.
 */
export function preciosPromoEnCurso(promoPlan: string | null | undefined): { promo: number; normal: number } {
  const nivel = /^symvora-(pro|premium)-monthly-promo50/.exec(promoPlan ?? "")?.[1] as Nivel | undefined;
  if (nivel) return { promo: precioPromoNivelCents(nivel) / 100, normal: precioNivelCents(nivel, "monthly") / 100 };
  return { promo: PRECIO_PROMO_MXN, normal: precioListaMXN("monthly") };
}

/** Cobros promocionales con los que nace una suscripcion nueva de un nivel (6 en Pro/Premium mensual, 0 si no). */
export function cobrosPromoInicialesNivel(nivel: Nivel, period: BillingPeriod): number {
  return promoAplicaANivel(nivel, period) ? PROMO_LANZAMIENTO.cobros : 0;
}

/** Plan normal al que vuelve una suscripcion de nivel cuando se agota su promocion (siempre mensual). */
export function clavePlanNormalDeNivel(nivel: Nivel): ClavePlan {
  return `${nivel}Monthly` as ClavePlan;
}

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
  cobrosRestantes: number,
  esNuevoCliente: boolean = true,
  ahora: Date = new Date()
): number {
  if (period === PROMO_LANZAMIENTO.periodo && cobrosRestantes > 0) {
    return PROMO_LANZAMIENTO.precioCents;
  }
  if (period === "yearly" && esPromoAnualTabletVigente(ahora) && esNuevoCliente) {
    return PROMO_ANUAL_TABLET.precioCents;
  }
  return SUBSCRIPTION_PRICE_CENTS[period];
}

/** Plan con el que arrancar un checkout nuevo. */
export function claveDePlanNuevo(
  period: BillingPeriod,
  esNuevoCliente: boolean = true,
  ahora: Date = new Date()
): ClavePlan {
  if (period === "yearly" && esPromoAnualTabletVigente(ahora) && esNuevoCliente) {
    return "yearlyTablet";
  }
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

/**
 * Oferta de regreso (migracion 096): quien quedo en solo lectura recibe el
 * dia 7 un correo con su primer mes de vuelta al precio promocional. Reutiliza
 * el plan `monthlyPromo` y el contador de arriba — con 1 cobro — asi que no
 * hace falta otro plan en Conekta, y el webhook lo devuelve solo al plan normal
 * tras ese cobro.
 */
export const COBROS_OFERTA_REGRESO = 1;

/** ?Aplica la oferta de regreso a este checkout? Solo mensual y dentro de su vigencia. */
export function ofertaRegresoVigente(
  hasta: string | null | undefined,
  period: BillingPeriod,
  ahora: Date = new Date()
): boolean {
  if (period !== PROMO_LANZAMIENTO.periodo || !hasta) return false;
  const limite = new Date(hasta);
  return !Number.isNaN(limite.getTime()) && limite >= ahora;
}
