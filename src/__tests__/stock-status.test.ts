import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  SIN_CATEGORIA,
  applyProductFilters,
  countActiveFilters,
  countByStatus,
  sortProducts,
  stockStatus,
} from "@/features/inventory/stock-status";

const p = (o: Partial<Parameters<typeof applyProductFilters>[0][number]> = {}) => ({
  nombre: "Producto",
  stock_actual: 10,
  stock_minimo: 5,
  precio_venta: 100,
  categoria: "Bebidas" as string | null,
  creado_en: "2026-01-01T00:00:00.000Z",
  actualizado_en: "2026-01-01T00:00:00.000Z",
  ...o,
});

describe("stockStatus", () => {
  it("un producto sin existencias es AGOTADO, no 'bajo'", () => {
    // La regla vieja de la tabla (`stock <= minimo`) lo marcaba como "Stock
    // bajo": 0 <= 5 es cierto. Así el mismo producto decía "bajo" en la
    // etiqueta y "agotado" en el filtro.
    expect(stockStatus({ stock_actual: 0, stock_minimo: 5 })).toBe("agotado");
  });

  it("stock negativo también es agotado", () => {
    // Puede quedar negativo por una venta offline (migración 051).
    expect(stockStatus({ stock_actual: -3, stock_minimo: 5 })).toBe("agotado");
  });

  it("queda algo pero por debajo del mínimo: bajo", () => {
    expect(stockStatus({ stock_actual: 2, stock_minimo: 5 })).toBe("bajo");
    expect(stockStatus({ stock_actual: 5, stock_minimo: 5 })).toBe("bajo");
  });

  it("por encima del mínimo: ok", () => {
    expect(stockStatus({ stock_actual: 6, stock_minimo: 5 })).toBe("ok");
  });

  it("sin mínimo definido, todo lo que tenga existencias es ok", () => {
    // stock_minimo = 0 es el valor por defecto. Sin mínimo no hay forma de
    // saber qué es "poco", así que no se inventa un umbral.
    expect(stockStatus({ stock_actual: 1, stock_minimo: 0 })).toBe("ok");
    expect(stockStatus({ stock_actual: 0, stock_minimo: 0 })).toBe("agotado");
  });

  it("los tres grupos no se solapan y cubren todo", () => {
    const productos = [
      { stock_actual: 0, stock_minimo: 5 },
      { stock_actual: 3, stock_minimo: 5 },
      { stock_actual: 9, stock_minimo: 5 },
      { stock_actual: -1, stock_minimo: 2 },
      { stock_actual: 7, stock_minimo: 0 },
    ];
    const counts = countByStatus(productos);
    expect(counts.agotado + counts.bajo + counts.ok).toBe(productos.length);
    expect(counts).toEqual({ agotado: 2, bajo: 1, ok: 2 });
  });
});

describe("sortProducts", () => {
  const a = p({ nombre: "Aaa", precio_venta: 30, stock_actual: 1, creado_en: "2026-03-01T00:00:00Z", actualizado_en: "2026-01-01T00:00:00Z" });
  const b = p({ nombre: "Bbb", precio_venta: 10, stock_actual: 9, creado_en: "2026-01-01T00:00:00Z", actualizado_en: "2026-05-01T00:00:00Z" });
  const c = p({ nombre: "Ccc", precio_venta: 20, stock_actual: 5, creado_en: "2026-02-01T00:00:00Z", actualizado_en: "2026-03-01T00:00:00Z" });
  const todos = [a, b, c];

  const nombres = (sort: Parameters<typeof sortProducts>[1]) =>
    sortProducts(todos, sort).map((x) => x.nombre);

  it("ordena por fecha de creación en ambos sentidos", () => {
    expect(nombres("recientes")).toEqual(["Aaa", "Ccc", "Bbb"]);
    expect(nombres("antiguos")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por última modificación", () => {
    expect(nombres("modificados")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por stock en ambos sentidos", () => {
    expect(nombres("stockAsc")).toEqual(["Aaa", "Ccc", "Bbb"]);
    expect(nombres("stockDesc")).toEqual(["Bbb", "Ccc", "Aaa"]);
  });

  it("ordena por precio en ambos sentidos", () => {
    expect(nombres("precioAsc")).toEqual(["Bbb", "Ccc", "Aaa"]);
    expect(nombres("precioDesc")).toEqual(["Aaa", "Ccc", "Bbb"]);
  });

  it("ordena por título en ambos sentidos", () => {
    expect(nombres("nombreAsc")).toEqual(["Aaa", "Bbb", "Ccc"]);
    expect(nombres("nombreDesc")).toEqual(["Ccc", "Bbb", "Aaa"]);
  });

  it("desempata por nombre para que el orden sea estable", () => {
    // Sin desempate, dos productos del mismo precio podrían intercambiarse
    // entre recargas y la lista "saltaría" sin motivo aparente.
    const x = p({ nombre: "Zeta", precio_venta: 50 });
    const y = p({ nombre: "Alfa", precio_venta: 50 });
    expect(sortProducts([x, y], "precioAsc").map((i) => i.nombre)).toEqual([
      "Alfa",
      "Zeta",
    ]);
  });

  it("no muta el array original", () => {
    const original = [a, b, c];
    sortProducts(original, "nombreDesc");
    expect(original.map((x) => x.nombre)).toEqual(["Aaa", "Bbb", "Ccc"]);
  });

  it("un producto sin fecha no rompe el orden", () => {
    const sinFecha = p({ nombre: "Sin", creado_en: null });
    const r = sortProducts([sinFecha, a], "recientes");
    expect(r.map((x) => x.nombre)).toEqual(["Aaa", "Sin"]);
  });
});

describe("applyProductFilters", () => {
  const agotado = p({ nombre: "Agotado", stock_actual: 0 });
  const bajo = p({ nombre: "Bajo", stock_actual: 2 });
  const ok = p({ nombre: "Ok", stock_actual: 20 });
  const sinCat = p({ nombre: "SinCat", stock_actual: 20, categoria: null });
  const todos = [agotado, bajo, ok, sinCat];

  it("sin filtros devuelve todo", () => {
    expect(applyProductFilters(todos, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("filtra por un grupo de stock", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, stock: ["agotado"] });
    expect(r.map((x) => x.nombre)).toEqual(["Agotado"]);
  });

  it("varios grupos de stock se suman", () => {
    const r = applyProductFilters(todos, {
      ...EMPTY_FILTERS,
      stock: ["agotado", "bajo"],
    });
    expect(r).toHaveLength(2);
  });

  it("filtra por categoría", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, categoria: "Bebidas" });
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.categoria === "Bebidas")).toBe(true);
  });

  it("filtra los que no tienen categoría", () => {
    const r = applyProductFilters(todos, { ...EMPTY_FILTERS, categoria: SIN_CATEGORIA });
    expect(r.map((x) => x.nombre)).toEqual(["SinCat"]);
  });

  it("combina stock y categoría, no los sustituye", () => {
    const r = applyProductFilters(todos, {
      ...EMPTY_FILTERS,
      stock: ["ok"],
      categoria: "Bebidas",
    });
    expect(r.map((x) => x.nombre)).toEqual(["Ok"]);
  });
});

describe("countActiveFilters", () => {
  it("sin filtros es cero", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("el orden por defecto NO cuenta como filtro activo", () => {
    // Si contara, el botón mostraría siempre un "1" y perdería significado.
    expect(countActiveFilters({ ...EMPTY_FILTERS, sort: DEFAULT_SORT })).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, sort: "precioAsc" })).toBe(1);
  });

  it("suma stock, categoría y orden", () => {
    expect(
      countActiveFilters({ stock: ["bajo"], categoria: "Ropa", sort: "precioAsc" })
    ).toBe(3);
  });
});
