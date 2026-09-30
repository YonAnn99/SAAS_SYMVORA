import { describe, expect, it } from "vitest";
import { ticketVentaEscPos } from "@/features/pos/impresora/ticket-escpos";
import type { SaleReceipt } from "@/features/pos/types/pos.types";

/** Bytes -> texto legible (solo ASCII; los comandos quedan como basura inofensiva). */
const comoTexto = (b: Uint8Array) =>
  Array.from(b)
    .map((c) => (c === 0x0a ? "\n" : c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : ""))
    .join("");

const base: SaleReceipt = {
  items: [
    {
      productId: "p1",
      varianteId: null,
      nombre: "Tortillas de maíz de un kilo recién hechas",
      cantidad: 2,
      precioUnitario: 22,
      descuento: 0,
      unidad_medida: "PIEZA",
    },
  ],
  total: 44,
  paymentMethod: "EFECTIVO",
  customerName: null,
  montoRecibido: 100,
  cambio: 56,
  reference: "a2be9f98-0000-0000-0000-000000000000",
};

describe("ticket de venta en ESC/POS", () => {
  it("trae negocio, productos, total, efectivo, cambio y el aviso fiscal", () => {
    const txt = comoTexto(
      ticketVentaEscPos({ receipt: base, negocio: { nombre: "Pruebas SYMVORA" }, ancho: 58, metodoPagoTexto: "Efectivo" })
    );
    expect(txt).toContain("Pruebas SYMVORA");
    expect(txt).toContain("DETALLE DE PRODUCTOS");
    expect(txt).toContain("44.00");
    expect(txt).toContain("Efectivo $");
    expect(txt).toContain("56.00");
    expect(txt).toContain("SIN VALIDEZ FISCAL");
    expect(txt).not.toContain("REIMPRESI");
  });

  it("un nombre largo se parte en renglones del ancho del papel", () => {
    const txt = comoTexto(
      ticketVentaEscPos({ receipt: base, negocio: { nombre: "N" }, ancho: 58, metodoPagoTexto: "Efectivo" })
    );
    const lineas = txt.split("\n");
    const primera = lineas.findIndex((l) => l.includes("Tortillas"));
    // El nombre (43 caracteres) no cabe en 32: su final queda en el renglon siguiente.
    expect(lineas[primera]).not.toContain("hechas");
    expect(lineas[primera + 1]).toContain("hechas");
  });

  it("con otro metodo de pago muestra el metodo; reimpresion lleva su distintivo", () => {
    const txt = comoTexto(
      ticketVentaEscPos({
        receipt: { ...base, paymentMethod: "TARJETA", montoRecibido: null, esReimpresion: true },
        negocio: { nombre: "N" },
        ancho: 80,
        metodoPagoTexto: "Tarjeta",
      })
    );
    expect(txt).toContain("Tarjeta");
    expect(txt).not.toContain("Cambio $");
    expect(txt).toContain("*** REIMPRESI");
  });
  it("con descuento imprime el importe sin descontar, el subtotal y la linea de descuento", () => {
    const txt = comoTexto(
      ticketVentaEscPos({
        receipt: {
          ...base,
          items: [{ ...base.items[0], descuento: 4.4 }],
          total: 39.6,
          descuentoEtiqueta: "Descuento (10 %)",
        },
        negocio: { nombre: "Pruebas SYMVORA" },
        ancho: 58,
        metodoPagoTexto: "Efectivo",
      })
    );
    expect(txt).toContain("44.00");
    expect(txt).toContain("Subtotal $");
    expect(txt).toContain("Descuento (10 %) $");
    expect(txt).toContain("-4.40");
    expect(txt).toContain("39.60");
  });

  it("sin descuento ni IVA no agrega el desglose", () => {
    const txt = comoTexto(
      ticketVentaEscPos({ receipt: base, negocio: { nombre: "X" }, ancho: 58, metodoPagoTexto: "Efectivo" })
    );
    expect(txt).not.toContain("Subtotal $");
  });
});
