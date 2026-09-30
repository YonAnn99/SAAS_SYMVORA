import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, SIN_CATEGORIA } from "@/features/inventory/stock-status";
import { etiquetasAFiltros, filtrosAEtiquetas } from "@/features/inventory/filtros-etiquetas";

describe("filtros <-> etiquetas del Multi Select", () => {
  it("sin filtros no hay etiquetas", () => {
    expect(filtrosAEtiquetas(EMPTY_FILTERS)).toEqual([]);
  });

  it("ida y vuelta conserva los filtros (y el orden, que no es etiqueta)", () => {
    const filtros = {
      ...EMPTY_FILTERS,
      stock: ["bajo" as const, "agotado" as const],
      sinMinimo: true,
      soloFavoritos: true,
      categoria: "Bebidas",
      sort: "precio-desc" as typeof EMPTY_FILTERS.sort,
    };
    const etiquetas = filtrosAEtiquetas(filtros);
    expect(etiquetas).toEqual(["stock:bajo", "stock:agotado", "sinMinimo", "favoritos", "cat:Bebidas"]);
    expect(etiquetasAFiltros(etiquetas, filtros)).toEqual(filtros);
  });

  it("quitar una etiqueta desactiva solo ese filtro", () => {
    const filtros = { ...EMPTY_FILTERS, stock: ["bajo" as const], soloFavoritos: true };
    const r = etiquetasAFiltros(["favoritos"], filtros);
    expect(r.stock).toEqual([]);
    expect(r.soloFavoritos).toBe(true);
  });

  it("una sola categoria: la recien elegida reemplaza a la anterior", () => {
    const filtros = { ...EMPTY_FILTERS, categoria: "Bebidas" };
    const r = etiquetasAFiltros(["cat:Bebidas", "cat:Limpieza"], filtros);
    expect(r.categoria).toBe("Limpieza");
  });

  it("'Sin categoria' tambien es una categoria", () => {
    const r = etiquetasAFiltros([`cat:${SIN_CATEGORIA}`], EMPTY_FILTERS);
    expect(r.categoria).toBe(SIN_CATEGORIA);
  });
});
