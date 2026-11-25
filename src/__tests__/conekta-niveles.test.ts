import { describe, expect, it, vi } from "vitest";
import {
  clavePlanDeNivel,
  clavePlanNormalDeNivel,
  cobrosPromoInicialesNivel,
  precioNivelCobroCents,
  preciosPromoEnCurso,
  type ClavePlan,
} from "@/features/payments/promocion";
import { NIVELES_ORDEN, PRECIOS_NIVEL_CENTS, precioPromoNivelCents, promoAplicaANivel } from "@/lib/niveles";
import { PROMO_LANZAMIENTO } from "@/lib/pricing";

// `config.ts` instancia el SDK de Conekta al cargarse: sin llave solo avisa, pero se silencia el aviso.
vi.spyOn(console, "warn").mockImplementation(() => {});

// La primera importacion de `config.ts` (instancia el SDK) pasa de 5 s cuando la suite completa corre en paralelo.
vi.setConfig({ testTimeout: 30_000 });

describe("planes de Conekta por nivel", () => {
  it("clavePlanDeNivel arma la clave nivel + periodo", () => {
    expect(clavePlanDeNivel("basico", "monthly")).toBe("basicoMonthly");
    expect(clavePlanDeNivel("pro", "yearly")).toBe("proYearly");
    expect(clavePlanDeNivel("premium", "monthly")).toBe("premiumMonthly");
  });

  it("el cobro de un nivel es su precio de lista (sin promocion)", () => {
    for (const n of NIVELES_ORDEN) {
      expect(precioNivelCobroCents(n, "monthly")).toBe(PRECIOS_NIVEL_CENTS[n].monthly);
      expect(precioNivelCobroCents(n, "yearly")).toBe(PRECIOS_NIVEL_CENTS[n].yearly);
    }
  });

  it("cada plan de nivel tiene su id y su monto, y no pisa a los planes de siempre", async () => {
    const { CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS } = await import("@/features/payments/services/conekta/config");
    const claves = NIVELES_ORDEN.flatMap((n) =>
      (["monthly", "yearly"] as const).map((p) => ({ n, p, clave: clavePlanDeNivel(n, p) as ClavePlan }))
    );
    for (const { n, p, clave } of claves) {
      expect(CONEKTA_PLAN_IDS[clave]).toBe(`symvora-${n}-${p}-v1`);
      expect(CONEKTA_PLAN_AMOUNTS[clave]).toBe(PRECIOS_NIVEL_CENTS[n][p]);
    }
    // Ids distintos entre si y distintos de los planes existentes.
    const ids = Object.values(CONEKTA_PLAN_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    // Los planes de siempre siguen intactos (los clientes actuales los usan).
    expect(CONEKTA_PLAN_IDS.monthly).toBe("symvora-basic-monthly-v3");
    expect(CONEKTA_PLAN_IDS.yearly).toBe("symvora-basic-yearly-v3");
    expect(CONEKTA_PLAN_AMOUNTS.monthly).toBe(39900);
    expect(CONEKTA_PLAN_AMOUNTS.yearly).toBe(358800);
  });

  it("la promo de lanzamiento es -50 % y solo de Pro y Premium mensual", () => {
    // Redondeados a mano por el dueño: Pro $225 (lista $449) y Premium $299 (lista $599).
    expect(precioPromoNivelCents("pro")).toBe(22500);
    expect(precioPromoNivelCents("premium")).toBe(29900);
    for (const n of ["pro", "premium"] as const) {
      expect(precioPromoNivelCents(n)).toBeLessThan(PRECIOS_NIVEL_CENTS[n].monthly);
      expect(promoAplicaANivel(n, "monthly")).toBe(true);
      expect(promoAplicaANivel(n, "yearly")).toBe(false);
    }
    expect(promoAplicaANivel("basico", "monthly")).toBe(false);
    expect(promoAplicaANivel("basico", "yearly")).toBe(false);
  });

  it("clavePlanDeNivel con promo elige el plan promocional solo donde aplica", () => {
    expect(clavePlanDeNivel("pro", "monthly", true)).toBe("proMonthlyPromo");
    expect(clavePlanDeNivel("premium", "monthly", true)).toBe("premiumMonthlyPromo");
    expect(clavePlanDeNivel("basico", "monthly", true)).toBe("basicoMonthly");
    expect(clavePlanDeNivel("pro", "yearly", true)).toBe("proYearly");
    expect(clavePlanDeNivel("pro", "monthly")).toBe("proMonthly");
    expect(clavePlanNormalDeNivel("premium")).toBe("premiumMonthly");
  });

  it("los cobros promocionales con los que nace una suscripcion de nivel", () => {
    expect(cobrosPromoInicialesNivel("pro", "monthly")).toBe(PROMO_LANZAMIENTO.cobros);
    expect(cobrosPromoInicialesNivel("premium", "monthly")).toBe(PROMO_LANZAMIENTO.cobros);
    expect(cobrosPromoInicialesNivel("basico", "monthly")).toBe(0);
    expect(cobrosPromoInicialesNivel("pro", "yearly")).toBe(0);
  });

  it("el cobro lo manda el contador: con cobros restantes, promo; sin ellos, lista (aunque la promo se apague)", () => {
    expect(precioNivelCobroCents("pro", "monthly", 6)).toBe(22500);
    expect(precioNivelCobroCents("pro", "monthly", 1)).toBe(22500);
    expect(precioNivelCobroCents("pro", "monthly", 0)).toBe(44900);
    expect(precioNivelCobroCents("premium", "monthly", 3)).toBe(29900);
    expect(precioNivelCobroCents("basico", "monthly", 6)).toBe(24900);
    expect(precioNivelCobroCents("pro", "yearly", 6)).toBe(404400);
  });

  it("los planes promocionales de Conekta llevan su id y su monto, y no pisan a los demas", async () => {
    const { CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS } = await import("@/features/payments/services/conekta/config");
    expect(CONEKTA_PLAN_IDS.proMonthlyPromo).toBe("symvora-pro-monthly-promo50-v1");
    expect(CONEKTA_PLAN_IDS.premiumMonthlyPromo).toBe("symvora-premium-monthly-promo50-v1");
    expect(CONEKTA_PLAN_AMOUNTS.proMonthlyPromo).toBe(22500);
    expect(CONEKTA_PLAN_AMOUNTS.premiumMonthlyPromo).toBe(29900);
    expect(CONEKTA_PLAN_IDS.monthlyPromo).toBe("symvora-basic-monthly-promo50-v1");
    expect(CONEKTA_PLAN_AMOUNTS.monthlyPromo).toBe(19900);
  });

  it("/billing muestra el precio de la promo que SI tiene la suscripcion", async () => {
    const { CONEKTA_PLAN_IDS } = await import("@/features/payments/services/conekta/config");
    expect(preciosPromoEnCurso(CONEKTA_PLAN_IDS.proMonthlyPromo)).toEqual({ promo: 225, normal: 449 });
    expect(preciosPromoEnCurso(CONEKTA_PLAN_IDS.premiumMonthlyPromo)).toEqual({ promo: 299, normal: 599 });
    expect(preciosPromoEnCurso(CONEKTA_PLAN_IDS.monthlyPromo)).toEqual({ promo: 199, normal: 399 });
    expect(preciosPromoEnCurso(null)).toEqual({ promo: 199, normal: 399 });
  });
});
