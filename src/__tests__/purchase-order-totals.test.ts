import { describe, expect, it } from "vitest";
import {
  ordenLlevaIva,
  totalesOrdenCompra,
} from "@/features/inventory/purchase-order-totals";

/**
 * Hasta ahora el cálculo de una orden de compra no tenía ni un test: vivía
 * dentro de un hook de React y, peor, estaba escrito DOS veces —una para pintar
 * y otra para guardar—. Mientras el IVA fuera obligatorio las dos daban igual y
 * nadie notaba la divergencia.
 */

describe("totalesOrdenCompra", () => {
  const CIEN = [{ cantidad_solicitada: "10", costo_unitario: "10" }];

  it("con IVA aplica el 16 por ciento", () => {
    expect(totalesOrdenCompra(CIEN, true)).toEqual({
      subtotal: 100,
      impuesto: 16,
      total: 116,
    });
  });

  it("sin IVA deja el impuesto en cero y el total igual al subtotal", () => {
    expect(totalesOrdenCompra(CIEN, false)).toEqual({
      subtotal: 100,
      impuesto: 0,
      total: 100,
    });
  });

  it("suma varios renglones", () => {
    const totales = totalesOrdenCompra(
      [
        { cantidad_solicitada: "2", costo_unitario: "30" },
        { cantidad_solicitada: "1.5", costo_unitario: "20" },
      ],
      true
    );
    expect(totales.subtotal).toBe(90);
    expect(totales.impuesto).toBe(14.4);
    expect(totales.total).toBe(104.4);
  });

  it("redondea a dos decimales en vez de dejar que lo trunque la base", () => {
    // 33.33 * 3 = 99.99 y su IVA es 15.9984. Antes ese valor entraba crudo en
    // una columna DECIMAL(10,2) y lo recortaba Postgres, así que el total
    // guardado no cuadraba con la suma de sus partes.
    const totales = totalesOrdenCompra(
      [{ cantidad_solicitada: "3", costo_unitario: "33.33" }],
      true
    );
    expect(totales.subtotal).toBe(99.99);
    expect(totales.impuesto).toBe(16);
    expect(totales.total).toBe(115.99);
  });

  it("un renglón a medio escribir cuenta como cero, no como NaN", () => {
    // Los campos son de texto: mientras el usuario escribe, `cantidad` puede
    // estar vacía. Un NaN aquí acabaría guardado como importe de la orden.
    const totales = totalesOrdenCompra(
      [
        { cantidad_solicitada: "", costo_unitario: "50" },
        { cantidad_solicitada: "2", costo_unitario: "" },
        { cantidad_solicitada: "1", costo_unitario: "10" },
      ],
      true
    );
    expect(totales.subtotal).toBe(10);
    expect(Number.isNaN(totales.total)).toBe(false);
  });

  it("sin renglones da todo en cero", () => {
    expect(totalesOrdenCompra([], true)).toEqual({
      subtotal: 0,
      impuesto: 0,
      total: 0,
    });
  });
});

describe("ordenLlevaIva", () => {
  it("una orden guardada con impuesto lleva IVA", () => {
    expect(ordenLlevaIva({ subtotal: 100, impuesto: 16 })).toBe(true);
  });

  it("una orden guardada con impuesto en cero no lleva IVA", () => {
    // Es lo que rehidrata la casilla al reabrir para editar. Sin esto, abrir
    // una orden emitida sin IVA y guardarla le devolvería el 16% en silencio.
    expect(ordenLlevaIva({ subtotal: 100, impuesto: 0 })).toBe(false);
  });

  it("acepta los importes como cadena, que es como llegan de PostgREST", () => {
    // Las columnas son DECIMAL y PostgREST las entrega como texto: "16.00".
    expect(ordenLlevaIva({ subtotal: "100.00", impuesto: "16.00" })).toBe(true);
    expect(ordenLlevaIva({ subtotal: "100.00", impuesto: "0.00" })).toBe(false);
  });

  it("con subtotal cero no revienta ni divide entre cero", () => {
    expect(ordenLlevaIva({ subtotal: 0, impuesto: 0 })).toBe(false);
  });

  it("una orden anterior al interruptor sigue saliendo con su IVA", () => {
    // Toda orden creada antes de este cambio se guardó con el 16%. Al abrirla
    // para editar tiene que seguir marcada, o al guardar perdería su impuesto.
    expect(ordenLlevaIva({ subtotal: 1000, impuesto: 160 })).toBe(true);
  });
});
