import { describe, expect, it } from "vitest";
import { easeOutExpo, formatearContador } from "@/lib/contador";

describe("formatearContador", () => {
  it.each([
    [14542, { prefijo: "$" }, "$14,542"],
    [7, {}, "7"],
    [1147.25, { prefijo: "$", decimales: 2 }, "$1,147.25"],
    [14542, { prefijo: "$", decimales: 2 }, "$14,542.00"],
    [-1147.25, { prefijo: "$", decimales: 2 }, "-$1,147.25"],
    [-0.001, { prefijo: "$", decimales: 2 }, "$0.00"],
    [33.333, { sufijo: "%", decimales: 1 }, "33.3%"],
    [0.6, {}, "1"],
  ] as const)("%s → %s", (valor, formato, esperado) => {
    expect(formatearContador(valor, formato)).toBe(esperado);
  });
});

describe("easeOutExpo", () => {
  it("va de 0 a 1 y crece", () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    let anterior = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeOutExpo(i / 20);
      expect(v).toBeGreaterThan(anterior);
      anterior = v;
    }
  });

  it("sube muy rapido al principio: a la mitad ya paso el 95 %", () => {
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.95);
  });
});
