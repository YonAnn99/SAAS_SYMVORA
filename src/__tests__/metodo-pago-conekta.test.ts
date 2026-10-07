import { describe, it, expect } from "vitest";
import {
  METODOS_POR_TIPO,
  metodoDePagoConekta,
  metodoPendiente,
} from "@/features/payments/metodo-pago-conekta";

describe("METODOS_POR_TIPO", () => {
  it("«Otros métodos de pago» ofrece efectivo, SPEI, BBVA y Aplazo", () => {
    expect(METODOS_POR_TIPO.unico).toEqual(["cash", "bank_transfer", "pay_by_bank", "bnpl"]);
  });

  it("el pago único no incluye tarjeta: la tarjeta es la suscripción automática", () => {
    expect(METODOS_POR_TIPO.unico).not.toContain("card");
  });
});

describe("metodoPendiente", () => {
  it("siempre da un valor del enum (nunca «unico»)", () => {
    expect(metodoPendiente("unico")).toBe("cash");
    expect(metodoPendiente("cash")).toBe("cash");
    expect(metodoPendiente(undefined)).toBe("cash");
    expect(metodoPendiente("bank_transfer")).toBe("bank_transfer");
  });
});

describe("metodoDePagoConekta", () => {
  it("los valores del enum pasan igual", () => {
    for (const m of ["card", "cash", "spei", "pay_by_bank", "bnpl", "bank_transfer", "oxxo"]) {
      expect(metodoDePagoConekta(m)).toBe(m);
    }
  });

  it("un cargo con tarjeta («credit»/«debit») es tarjeta", () => {
    expect(metodoDePagoConekta("credit")).toBe("card");
    expect(metodoDePagoConekta("debit")).toBe("card");
  });

  it("variantes de efectivo y transferencia", () => {
    expect(metodoDePagoConekta("oxxo_cash")).toBe("cash");
    expect(metodoDePagoConekta("SPEI")).toBe("spei");
    expect(metodoDePagoConekta("aplazo")).toBe("bnpl");
  });

  it("sin tipo, tarjeta; un tipo desconocido no rompe el registro", () => {
    expect(metodoDePagoConekta(undefined)).toBe("card");
    expect(metodoDePagoConekta("")).toBe("card");
    expect(metodoDePagoConekta("algo_nuevo")).toBe("manual");
  });
});
