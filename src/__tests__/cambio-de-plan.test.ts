import { describe, expect, it } from "vitest";
import {
  modoDeCambio,
  nivelCambiaAhora,
  precioDesdeProximoCobroMXN,
  tipoDeCambio,
} from "@/features/payments/cambio-de-plan";

describe("cambio de plan de quien ya paga", () => {
  it("sube, baja o es el mismo", () => {
    expect(tipoDeCambio("basico", "pro")).toBe("sube");
    expect(tipoDeCambio("pro", "premium")).toBe("sube");
    expect(tipoDeCambio("premium", "pro")).toBe("baja");
    expect(tipoDeCambio("pro", "basico")).toBe("baja");
    expect(tipoDeCambio("pro", "pro")).toBe("igual");
  });

  it("un negocio heredado (todo permitido) nunca «sube»", () => {
    expect(tipoDeCambio(null, "premium")).toBe("igual");
    expect(tipoDeCambio(null, "pro")).toBe("baja");
    expect(tipoDeCambio(null, "basico")).toBe("baja");
  });

  it("subir cambia el nivel ya; bajar espera al siguiente cobro", () => {
    expect(nivelCambiaAhora("sube")).toBe(true);
    expect(nivelCambiaAhora("baja")).toBe(false);
    expect(nivelCambiaAhora("igual")).toBe(false);
  });

  it("autoservicio solo mensual: tarjeta con suscripción, pago único sin ella; lo anual va por soporte", () => {
    expect(modoDeCambio({ periodo: "monthly", tieneSuscripcionRecurrente: true })).toBe("tarjeta");
    expect(modoDeCambio({ periodo: "monthly", tieneSuscripcionRecurrente: false })).toBe("pago_unico");
    expect(modoDeCambio({ periodo: "yearly", tieneSuscripcionRecurrente: true })).toBe("soporte");
    expect(modoDeCambio({ periodo: "yearly", tieneSuscripcionRecurrente: false })).toBe("soporte");
  });

  it("el precio desde el próximo cobro es el de lista, sin promoción", () => {
    expect(precioDesdeProximoCobroMXN("basico", "monthly")).toBe(249);
    expect(precioDesdeProximoCobroMXN("pro", "monthly")).toBe(449);
    expect(precioDesdeProximoCobroMXN("premium", "monthly")).toBe(599);
  });
});
