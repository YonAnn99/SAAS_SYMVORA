import { describe, expect, it } from "vitest";
import {
  etiquetaDescuento,
  montoDescuento,
  repartirDescuento,
  validarDescuento,
} from "@/features/pos/descuento-ticket";

const linea = (precioUnitario: number, cantidad = 1) => ({
  precioUnitario,
  cantidad,
  descuento: 0,
});

describe("montoDescuento", () => {
  it("porcentaje redondeado a centavos", () => {
    expect(montoDescuento(25, { tipo: "porcentaje", valor: 10 })).toBe(2.5);
    expect(montoDescuento(33.33, { tipo: "porcentaje", valor: 15 })).toBe(5);
  });

  it("un monto fijo no pasa del subtotal", () => {
    expect(montoDescuento(40, { tipo: "monto", valor: 50 })).toBe(40);
  });

  it("sin descuento o con valor inválido es cero", () => {
    expect(montoDescuento(40, null)).toBe(0);
    expect(montoDescuento(40, { tipo: "monto", valor: 0 })).toBe(0);
  });
});

describe("repartirDescuento", () => {
  it("la suma de los renglones cuadra exacto con el descuento", () => {
    // Tres renglones iguales y $10 de descuento: 3.33 + 3.33 + 3.34.
    const items = [linea(10), linea(10), linea(10)];
    const r = repartirDescuento(items, { tipo: "monto", valor: 10 });
    const suma = r.reduce((a, b) => a + Math.round(b.descuento * 100), 0);
    expect(suma).toBe(1000);
  });

  it("reparte proporcional al importe", () => {
    const r = repartirDescuento([linea(75), linea(25)], {
      tipo: "porcentaje",
      valor: 10,
    });
    expect(r.map((x) => x.descuento)).toEqual([7.5, 2.5]);
  });

  it("ningún renglón pasa de su importe", () => {
    const r = repartirDescuento([linea(0.01), linea(99.99)], {
      tipo: "monto",
      valor: 100,
    });
    expect(r[0].descuento).toBeLessThanOrEqual(0.01);
    expect(r[1].descuento).toBeLessThanOrEqual(99.99);
    expect(r[0].descuento + r[1].descuento).toBeCloseTo(100, 2);
  });

  it("considera la cantidad (precio × cantidad)", () => {
    const r = repartirDescuento([linea(10, 3), linea(10, 1)], {
      tipo: "monto",
      valor: 4,
    });
    expect(r.map((x) => x.descuento)).toEqual([3, 1]);
  });

  it("sin descuento devuelve los mismos renglones", () => {
    const items = [linea(10)];
    expect(repartirDescuento(items, null)).toBe(items);
  });
});

describe("validarDescuento", () => {
  it("el cajero no pasa del 10 %", () => {
    expect(validarDescuento({ tipo: "porcentaje", valor: 10 }, 100, 10)).toBeNull();
    expect(validarDescuento({ tipo: "porcentaje", valor: 11 }, 100, 10)).toMatch(/10 %/);
    // $15 de $100 es 15 %: también se rechaza.
    expect(validarDescuento({ tipo: "monto", valor: 15 }, 100, 10)).toMatch(/10 %/);
  });

  it("sin tope (dueño) solo se limitan los imposibles", () => {
    expect(validarDescuento({ tipo: "porcentaje", valor: 50 }, 100, null)).toBeNull();
    expect(validarDescuento({ tipo: "porcentaje", valor: 101 }, 100, null)).not.toBeNull();
    expect(validarDescuento({ tipo: "monto", valor: 120 }, 100, null)).not.toBeNull();
    expect(validarDescuento({ tipo: "monto", valor: 0 }, 100, null)).not.toBeNull();
  });
});

describe("etiquetaDescuento", () => {
  it("muestra el porcentaje solo si lo es", () => {
    expect(etiquetaDescuento({ tipo: "porcentaje", valor: 10 })).toBe("Descuento (10 %)");
    expect(etiquetaDescuento({ tipo: "monto", valor: 50 })).toBe("Descuento");
  });
});
