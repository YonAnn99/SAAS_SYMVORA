import { describe, expect, it } from "vitest";
import { esFraccionable, unidadDeVenta } from "@/lib/unidades";

describe("unidadDeVenta (migracion 104)", () => {
  const producto = { unidad_medida: "PIEZA" as const };

  it("sin variante, la del producto", () => {
    expect(unidadDeVenta(producto)).toBe("PIEZA");
    expect(unidadDeVenta(producto, null)).toBe("PIEZA");
  });

  it("variante sin unidad propia hereda la del producto", () => {
    expect(unidadDeVenta(producto, { unidad_medida: null })).toBe("PIEZA");
    expect(unidadDeVenta(producto, {})).toBe("PIEZA");
  });

  it("variante con unidad propia manda (y decide si es granel)", () => {
    const u = unidadDeVenta<string>(producto, { unidad_medida: "KG" });
    expect(u).toBe("KG");
    expect(esFraccionable(u)).toBe(true);
  });
});
