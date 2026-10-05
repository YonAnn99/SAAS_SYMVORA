import { describe, expect, it } from "vitest";
import { seVendeComoGeneral, vendibleEnPos } from "@/features/sucursales/stock";

describe("vendibleEnPos", () => {
  it("un producto general (stock 0) entra si alguna variante tiene stock", () => {
    expect(vendibleEnPos({ stock_actual: 0 }, [{ stock_actual: 0 }, { stock_actual: 4 }])).toBe(true);
  });

  it("sin stock propio ni en variantes, no entra", () => {
    expect(vendibleEnPos({ stock_actual: 0 }, [{ stock_actual: 0 }])).toBe(false);
    expect(vendibleEnPos({ stock_actual: 0 }, undefined)).toBe(false);
  });

  it("conserva la regla de siempre: stock propio o servicio", () => {
    expect(vendibleEnPos({ stock_actual: 3 }, undefined)).toBe(true);
    expect(vendibleEnPos({ stock_actual: 0, es_servicio: true }, undefined)).toBe(true);
  });

  it("lo que el local marco como 'no se vende aqui' no entra", () => {
    expect(vendibleEnPos({ stock_actual: 9, se_vende: false }, [{ stock_actual: 2 }])).toBe(false);
  });
});

describe("seVendeComoGeneral", () => {
  it("sin variantes, el producto se vende tal cual", () => {
    expect(seVendeComoGeneral({ stock_actual: 0, precio_venta: 10 }, [])).toBe(true);
    expect(seVendeComoGeneral({ stock_actual: 5, precio_venta: 10 }, undefined)).toBe(true);
  });

  it("el producto general de un producto con variantes nunca se vende solo", () => {
    expect(seVendeComoGeneral({ stock_actual: 0, precio_venta: 0 }, [{}])).toBe(false);
    expect(seVendeComoGeneral({ stock_actual: 4, precio_venta: 0 }, [{}])).toBe(false);
  });

  it("con stock sin clasificar y precio (caso heredado), si se ofrece", () => {
    expect(seVendeComoGeneral({ stock_actual: 4, precio_venta: 250 }, [{}])).toBe(true);
  });
});
