import { describe, expect, it } from "vitest";
import { rangoDePrecio, resumenConVariantes } from "@/features/inventory/resumen-variantes";

const padre = { precio_venta: 0, stock_actual: 0, stock_minimo: 0 };

describe("resumenConVariantes", () => {
  it("sin variantes es el producto de siempre", () => {
    const r = resumenConVariantes({ precio_venta: 25, stock_actual: 3, stock_minimo: 5 }, []);
    expect(r).toMatchObject({ tieneVariantes: false, stockTotal: 3, precioMin: 25, estado: "bajo" });
  });

  it("un producto general (solo nombre) suma el stock de sus variantes y da el rango de precio", () => {
    const r = resumenConVariantes(padre, [
      { precio_venta: 18, stock_actual: 20, stock_minimo: 5 },
      { precio_venta: 32, stock_actual: 10, stock_minimo: 2 },
    ]);
    expect(r).toMatchObject({ tieneVariantes: true, stockTotal: 30, precioMin: 18, precioMax: 32, estado: "ok" });
    expect(rangoDePrecio(r)).toBe("$18.00 – $32.00");
  });

  it("suma tambien el stock propio del padre si tiene", () => {
    const r = resumenConVariantes({ precio_venta: 18, stock_actual: 50, stock_minimo: 0 }, [
      { precio_venta: 32, stock_actual: 50 },
    ]);
    expect(r.stockTotal).toBe(100);
  });

  it("una variante agotada o en su minimo marca stock bajo", () => {
    expect(
      resumenConVariantes(padre, [
        { precio_venta: 18, stock_actual: 0 },
        { precio_venta: 32, stock_actual: 10 },
      ]).estado
    ).toBe("bajo");
    expect(
      resumenConVariantes(padre, [{ precio_venta: 18, stock_actual: 3, stock_minimo: 5 }]).estado
    ).toBe("bajo");
  });

  it("todo en cero es agotado", () => {
    expect(resumenConVariantes(padre, [{ precio_venta: 18, stock_actual: 0 }]).estado).toBe("agotado");
  });

  it("una variante con precio 0 usa el del producto", () => {
    const r = resumenConVariantes({ precio_venta: 20, stock_actual: 0, stock_minimo: 0 }, [
      { precio_venta: 0, stock_actual: 1 },
      { precio_venta: 25, stock_actual: 1 },
    ]);
    expect(r.precioMin).toBe(20);
    expect(rangoDePrecio({ precioMin: 20, precioMax: 20 })).toBe("$20.00");
  });
});
