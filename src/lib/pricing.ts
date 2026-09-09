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
