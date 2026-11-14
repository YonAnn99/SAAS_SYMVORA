// Fuente única del precio de la suscripción SaaS de SYMVORA.
//
// Vive aquí y no en features/payments/services/conekta/config.ts porque ese
// módulo instancia el SDK de Conekta al importarse, y estos montos también los
// necesita el JSON-LD de la landing pública (lib/seo/structured-data.ts).
//
// Los planes de Conekta son INMUTABLES en monto: cambiar un valor de aquí no
// actualiza un plan ya creado. Al cambiar el precio hay que bumpear también
// CONEKTA_PLAN_IDS en conekta/config.ts (ver el comentario allí).

export const SUBSCRIPTION_PRICE_CENTS = {
  monthly: 39900,
  yearly: 358800,
} as const;

export const SUBSCRIPTION_PRICE_MXN = {
  monthly: SUBSCRIPTION_PRICE_CENTS.monthly / 100, // $399 al mes
  yearly: SUBSCRIPTION_PRICE_CENTS.yearly / 100, // $3,588 al año = $299/mes
} as const;

export type BillingPeriod = keyof typeof SUBSCRIPTION_PRICE_CENTS;

// ---------------------------------------------------------------------------
// Promocion de lanzamiento: -50% sobre la mensualidad los primeros 6 cobros.
//
// `activa` es el UNICO interruptor. Apagarlo deja de ofrecer la promocion a
// quien se suscriba a partir de ese momento, pero NO toca a quien ya la tiene
// en curso: los cobros que le quedan viven en la base
// (`subscriptions.promo_cobros_restantes`), no aqui. Es lo que permite retirar
// la oferta de la landing sin subirle el precio a mitad de promocion a nadie.
//
// Solo mensual, por decision de negocio: "6 meses a mitad de precio" no se
// traduce a un cobro anual unico sin inventarse que significa.
export const PROMO_LANZAMIENTO = {
  activa: true,
  periodo: "monthly",
  precioCents: 19900,
  cobros: 6,
  descuentoPct: 50,
} as const satisfies {
  activa: boolean;
  periodo: BillingPeriod;
  precioCents: number;
  cobros: number;
  descuentoPct: number;
};

// ---------------------------------------------------------------------------
// Promoción temporal: SYMVORA ANUAL TABLET por $4,788 MXN.
// Válida desde hoy hasta el 17 de noviembre de 2026 a las 23:59:59 (hora de México CST / UTC-6).
// Sustituye el cobro anual regular mientras esté activa.
export const PROMO_ANUAL_TABLET = {
  activa: true,
  id: "symvora-anual-tablet",
  nombre: "SYMVORA ANUAL TABLET",
  precioCents: 478800,
  validoHasta: "2026-11-17T23:59:59-06:00",
} as const;

export function esPromoAnualTabletVigente(ahora: Date = new Date()): boolean {
  if (!PROMO_ANUAL_TABLET.activa) return false;
  const limite = new Date(PROMO_ANUAL_TABLET.validoHasta);
  return !Number.isNaN(limite.getTime()) && ahora <= limite;
}

export function precioAnualVigenteCents(ahora: Date = new Date()): number {
  return esPromoAnualTabletVigente(ahora)
    ? PROMO_ANUAL_TABLET.precioCents
    : SUBSCRIPTION_PRICE_CENTS.yearly;
}

export function precioAnualVigenteMXN(ahora: Date = new Date()): number {
  return precioAnualVigenteCents(ahora) / 100;
}

