import { describe, expect, it, vi } from "vitest";
import { clavePlanDeNivel, precioNivelCobroCents, type ClavePlan } from "@/features/payments/promocion";
import { NIVELES_ORDEN, PRECIOS_NIVEL_CENTS } from "@/lib/niveles";

// `config.ts` instancia el SDK de Conekta al cargarse: sin llave solo avisa, pero se silencia el aviso.
vi.spyOn(console, "warn").mockImplementation(() => {});

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
});
