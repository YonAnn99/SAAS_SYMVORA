import { describe, expect, it } from "vitest";
import { montosRapidos } from "@/features/pos/montos-rapidos";

describe("montosRapidos", () => {
  it("los billetes con que probablemente paguen, mayores que el total", () => {
    expect(montosRapidos(74)).toEqual([80, 100, 200]);
    expect(montosRapidos(12.5)).toEqual([20, 50, 100]);
  });

  it("un total redondo no se repite como 'rápido' (para eso está Exacto)", () => {
    expect(montosRapidos(100)).toEqual([200, 500, 1000]);
  });

  it("sin total no hay montos", () => {
    expect(montosRapidos(0)).toEqual([]);
    expect(montosRapidos(Number.NaN)).toEqual([]);
  });

  it("totales grandes: solo lo que exista por encima", () => {
    expect(montosRapidos(1850)).toEqual([1860, 1900, 2000]);
  });
});
