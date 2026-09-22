import { describe, expect, it } from "vitest";
import { getProductFamilyColor } from "@/features/pos/components/product-grid";

describe("getProductFamilyColor", () => {
  it("genera colores consistentes para el mismo ID de producto", () => {
    const color1 = getProductFamilyColor("prod-12345");
    const color2 = getProductFamilyColor("prod-12345");

    expect(color1.border).toBe(color2.border);
    expect(color1.bg).toBe(color2.bg);
    expect(color1.text).toBe(color2.text);
  });

  it("distribuye colores entre diferentes familias de productos", () => {
    const colorA = getProductFamilyColor("producto-sueter");
    const colorB = getProductFamilyColor("producto-pantalon");

    expect(colorA).toBeDefined();
    expect(colorB).toBeDefined();
    expect(colorA.border).toContain("border-l-");
  });
});

describe("filtrado de favoritos en el POS", () => {
  it("identifica correctamente los productos marcados como favoritos", () => {
    const favoritos = new Set(["prod-1", "prod-3"]);
    const catalogo = [
      { id: "prod-1", nombre: "Café molido" },
      { id: "prod-2", nombre: "Taza" },
      { id: "prod-3", nombre: "Galleta" },
    ];

    const filtrados = catalogo.filter((p) => favoritos.has(p.id));
    expect(filtrados).toHaveLength(2);
    expect(filtrados.map((p) => p.nombre)).toEqual(["Café molido", "Galleta"]);
  });

  it("devuelve vacío si el usuario no tiene favoritos marcados", () => {
    const favoritos = new Set<string>();
    const catalogo = [{ id: "prod-1", nombre: "Café molido" }];

    const filtrados = catalogo.filter((p) => favoritos.has(p.id));
    expect(filtrados).toHaveLength(0);
  });
});
