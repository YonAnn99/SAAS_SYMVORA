import { describe, expect, it } from "vitest";
import {
  esMoneda,
  formatMXN,
  formatMoneda,
  formatMonedaCompacto,
  formatMonedaEntero,
  monedaDe,
  simboloMoneda,
} from "@/lib/money";
import { montosRapidos } from "@/features/pos/montos-rapidos";
import { montoCompleto, montoEje } from "@/components/charts/formato-grafica";
import { formatearImporte, marcaMonedaTicket } from "@/features/pos/ticket-format";
import { formatearContador } from "@/lib/contador";

/** Intl separa "1234,50 €" con un espacio duro; para comparar, espacios normales. */
const plano = (s: string) => s.replace(/\s/g, " ");

describe("moneda del negocio (migración 133)", () => {
  it("formatea cada moneda con el formato de su país", () => {
    expect(formatMoneda(1234.5, "MXN")).toBe("$1,234.50");
    expect(formatMoneda(1234.5, "USD")).toBe("$1,234.50");
    expect(plano(formatMoneda(1234.5, "EUR"))).toBe("1234,50 €");
    expect(plano(formatMoneda(12345.5, "EUR"))).toBe("12.345,50 €");
  });

  it("MXN es la moneda por defecto y formatMXN no cambia", () => {
    expect(formatMoneda(18)).toBe("$18.00");
    expect(formatMXN(18)).toBe("$18.00");
  });

  it("monedaDe acepta solo las tres monedas y cae a MXN", () => {
    expect(monedaDe("EUR")).toBe("EUR");
    expect(monedaDe("USD")).toBe("USD");
    expect(monedaDe("GBP")).toBe("MXN");
    expect(monedaDe(null)).toBe("MXN");
    expect(monedaDe(undefined)).toBe("MXN");
    expect(esMoneda("MXN")).toBe(true);
    expect(esMoneda("mxn")).toBe(false);
  });

  it("entero, compacto y símbolo", () => {
    expect(formatMonedaEntero(200, "MXN")).toBe("$200");
    expect(plano(formatMonedaEntero(50, "EUR"))).toBe("50 €");
    expect(formatMonedaCompacto(850, "MXN")).toBe("$850");
    expect(plano(formatMonedaCompacto(12345, "EUR"))).toMatch(/€$/);
    expect(simboloMoneda("EUR")).toBe("€");
    expect(simboloMoneda("USD")).toBe("$");
  });
});

describe("montos rápidos por moneda", () => {
  it("pesos: los billetes de siempre", () => {
    expect(montosRapidos(74)).toEqual([80, 100, 200]);
    expect(montosRapidos(74, 3, "MXN")).toEqual([80, 100, 200]);
  });

  it("euros: billetes de 5, 10, 20, 50…", () => {
    expect(montosRapidos(7.5, 3, "EUR")).toEqual([10, 20, 50]);
    expect(montosRapidos(43, 3, "EUR")).toEqual([45, 50, 60]);
  });

  it("dólares: billetes de 1, 5, 10, 20…", () => {
    expect(montosRapidos(3.25, 3, "USD")).toEqual([4, 5, 10]);
  });
});

describe("gráficas, ticket y contador con euros", () => {
  it("formato de gráficas", () => {
    expect(montoCompleto(1234.5)).toBe("$1,234.50");
    expect(plano(montoCompleto(1234.5, "EUR"))).toBe("1234,50 €");
    expect(montoEje(850)).toBe("$850");
    expect(plano(montoEje(850, "EUR"))).toMatch(/850.*€/);
  });

  it("ticket: coma decimal y marca de la moneda", () => {
    expect(formatearImporte(18.5)).toBe("18.50");
    expect(formatearImporte(18.5, "EUR")).toBe("18,50");
    expect(marcaMonedaTicket("MXN")).toBe("$");
    expect(marcaMonedaTicket("EUR")).toBe("€");
    // En la térmica el euro va como texto: no todas traen «€».
    expect(marcaMonedaTicket("EUR", true)).toBe("EUR");
    expect(marcaMonedaTicket("USD", true)).toBe("$");
  });

  it("contador animado con moneda", () => {
    expect(formatearContador(1147.25, { moneda: "MXN" })).toBe("$1,147.25");
    expect(formatearContador(-1147.25, { moneda: "MXN" })).toBe("-$1,147.25");
    expect(plano(formatearContador(1147.25, { moneda: "EUR" }))).toBe("1147,25 €");
    // Sin moneda, el formato de siempre.
    expect(formatearContador(14542, { prefijo: "$" })).toBe("$14,542");
  });
});
