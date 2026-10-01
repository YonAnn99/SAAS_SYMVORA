import { describe, expect, it } from "vitest";
import {
  atributosDeVariante,
  combinaciones,
  etiquetaAtributos,
  hexDeColor,
  normalizarValor,
  resumenCompatible,
  skuDeCombinacion,
  tiposSugeridos,
} from "@/features/inventory/atributos-variante";

describe("combinaciones", () => {
  it("2 colores × 3 tallas = 6, el primer atributo cambia más lento", () => {
    const c = combinaciones([
      { tipo: "Color", valores: ["Rojo", "Azul"] },
      { tipo: "Talla", valores: ["S", "M", "L"] },
    ]);
    expect(c).toHaveLength(6);
    expect(c.map((combo) => combo.map((a) => a.valor).join("/"))).toEqual([
      "Rojo/S", "Rojo/M", "Rojo/L", "Azul/S", "Azul/M", "Azul/L",
    ]);
  });

  it("ignora atributos sin valores; sin nada da vacío", () => {
    expect(combinaciones([{ tipo: "Sabor", valores: ["Fresa"] }, { tipo: "Color", valores: [] }])).toEqual([
      [{ tipo: "Sabor", valor: "Fresa" }],
    ]);
    expect(combinaciones([])).toEqual([]);
  });
});

describe("resumenCompatible", () => {
  it("Color va a `color` y el resto a `talla` unido con ·", () => {
    expect(
      resumenCompatible([
        { tipo: "Sabor", valor: "Fresa" },
        { tipo: "Color", valor: "Rojo" },
        { tipo: "Capacidad", valor: "1 L" },
      ])
    ).toEqual({ talla: "Fresa · 1 L", color: "Rojo" });
  });

  it("sin Color, color es null; sin nada, ambos null", () => {
    expect(resumenCompatible([{ tipo: "Talla", valor: "M" }])).toEqual({ talla: "M", color: null });
    expect(resumenCompatible([])).toEqual({ talla: null, color: null });
  });
});

describe("variantes anteriores a los atributos", () => {
  it("se leen de talla/color", () => {
    expect(atributosDeVariante({ talla: "M", color: "Rojo" })).toEqual([
      { tipo: "Talla", valor: "M" },
      { tipo: "Color", valor: "Rojo" },
    ]);
    expect(etiquetaAtributos({ atributos: [], talla: "M", color: null })).toBe("M");
    expect(etiquetaAtributos({ atributos: [{ tipo: "Sabor", valor: "Fresa" }] })).toBe("Fresa");
  });
});

describe("tiposSugeridos", () => {
  it("primero los del producto, luego los del giro, Personalizado al final", () => {
    const tipos = tiposSugeridos("ROPA", ["Material"]);
    expect(tipos.slice(0, 3)).toEqual(["Material", "Talla", "Color"]);
    expect(tipos.at(-1)).toBe("Personalizado");
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it("abarrotes recomienda Presentación y Sabor", () => {
    expect(tiposSugeridos("ABARROTES").slice(0, 2)).toEqual(["Presentación", "Sabor"]);
  });
});

describe("colores y valores", () => {
  it("reconoce el color sin acentos ni mayúsculas", () => {
    expect(hexDeColor("cafe")).toBe(hexDeColor("Café"));
    expect(hexDeColor("ROJO")).toBe("#DC2626");
    expect(hexDeColor("turquesa neón")).toBeNull();
  });

  it("normaliza espacios y la primera letra", () => {
    expect(normalizarValor("  rojo   claro ")).toBe("Rojo claro");
  });

  it("SKU por combinación", () => {
    expect(skuDeCombinacion("play", ["Rojo", "M"])).toBe("PLAY-ROJ-M");
    expect(skuDeCombinacion("", ["Café"])).toBe("VAR-CAF");
  });
});
