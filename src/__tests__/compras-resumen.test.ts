import { describe, expect, it } from "vitest";
import { resumenCompras } from "@/features/inventory/compras-resumen";

const compras = [
  { id: "a", total: "500.00", estado: "RECIBIDA", proveedor: { nombre: "johana" } },
  { id: "b", total: 300, estado: "RECIBIDA", proveedor: { nombre: "Diego" } },
  { id: "c", total: 200, estado: "RECIBIDA", proveedor: { nombre: "johana" } },
  { id: "x", total: 999, estado: "CANCELADA", proveedor: { nombre: "Diego" } },
];

describe("resumenCompras", () => {
  const r = resumenCompras({
    compras,
    pagosCaja: [
      { compra_id: "a", monto: "500" },
      // El pago de una compra cancelada no cuenta: se devolvió o se ajustó.
      { compra_id: "x", monto: 999 },
    ],
    ordenesAbiertas: [
      {
        subtotal: 100,
        impuesto: 16,
        detalle: [
          { cantidad_solicitada: 10, cantidad_recibida: 4, costo_unitario: 10 },
          // Recibido de más no resta de lo pendiente.
          { cantidad_solicitada: 1, cantidad_recibida: 3, costo_unitario: 50 },
        ],
      },
    ],
    totalVentas: 1500,
  });

  it("suma solo las compras vigentes", () => {
    expect(r.totalComprado).toBe(1000);
    expect(r.numeroCompras).toBe(3);
  });

  it("cuenta lo pagado con caja de compras vigentes", () => {
    expect(r.pagadoConCaja).toBe(500);
  });

  it("ordena proveedores por monto", () => {
    expect(r.topProveedores).toEqual([
      { nombre: "johana", total: 700, compras: 2 },
      { nombre: "Diego", total: 300, compras: 1 },
    ]);
  });

  it("valora lo pendiente con el IVA de la orden", () => {
    // 6 pendientes × $10 = 60, más 16 % = 69.6
    expect(r.pendientePorRecibir).toBe(69.6);
    expect(r.ordenesAbiertas).toBe(1);
  });

  it("ventas menos compras", () => {
    expect(r.diferencia).toBe(500);
  });
});
