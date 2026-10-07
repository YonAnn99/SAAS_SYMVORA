import { describe, it, expect } from "vitest";
import { esUltimaVarianteActiva } from "@/features/inventory/archivar-variante";

const v = (id: string, producto_id: string, archivado_en: string | null = null) => ({
  id,
  producto_id,
  archivado_en,
});

describe("esUltimaVarianteActiva", () => {
  it("con otra variante activa del mismo producto, no es la última", () => {
    const lista = [v("a", "coca"), v("b", "coca"), v("c", "coca")];
    expect(esUltimaVarianteActiva(lista[0], lista)).toBe(false);
  });

  it("si es la única de su producto, es la última", () => {
    const lista = [v("a", "coca")];
    expect(esUltimaVarianteActiva(lista[0], lista)).toBe(true);
  });

  it("las variantes de OTROS productos no cuentan", () => {
    const lista = [v("a", "coca"), v("b", "leche"), v("c", "pan")];
    expect(esUltimaVarianteActiva(lista[0], lista)).toBe(true);
  });

  it("las ya archivadas del mismo producto no cuentan", () => {
    const lista = [v("a", "coca"), v("b", "coca", "2026-10-06T00:00:00Z")];
    expect(esUltimaVarianteActiva(lista[0], lista)).toBe(true);
  });

  it("la propia variante aunque no venga en la lista", () => {
    expect(esUltimaVarianteActiva(v("a", "coca"), [])).toBe(true);
    expect(esUltimaVarianteActiva(v("a", "coca"), [v("b", "coca")])).toBe(false);
  });
});
