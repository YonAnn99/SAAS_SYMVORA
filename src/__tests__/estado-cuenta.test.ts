import { describe, expect, it } from "vitest";
import { movimientosDeCuenta, normalizarEstadoCuenta } from "@/features/customers/estado-cuenta";

describe("estado de cuenta del cliente", () => {
  it("mezcla ventas fiadas y abonos, lo más reciente primero", () => {
    const m = movimientosDeCuenta({
      ventas: [
        { id: "v1", fecha: "2026-10-01T10:00:00Z", total: 500, estado: "COMPLETADA", cajero: null, sucursal: null },
        { id: "v2", fecha: "2026-10-20T10:00:00Z", total: 300, estado: "COMPLETADA", cajero: null, sucursal: null },
      ],
      abonos: [{ id: "a1", fecha: "2026-10-10T10:00:00Z", monto: 200, metodo_pago: "EFECTIVO", notas: null, registro: null }],
    });
    expect(m.map((x) => (x.tipo === "venta" ? x.venta.id : x.abono.id))).toEqual(["v2", "a1", "v1"]);
  });

  it("convierte los importes que llegan como texto", () => {
    const e = normalizarEstadoCuenta({
      cliente: { id: "c", nombre: "Ana", saldo_pendiente: "2317.00", limite_credito: "5000" },
      ventas: [{ id: "v", fecha: "2026-10-01T00:00:00Z", total: "99.50", estado: "COMPLETADA", cajero: null, sucursal: null }],
      abonos: [{ id: "a", fecha: "2026-10-02T00:00:00Z", monto: "10", metodo_pago: "EFECTIVO", notas: null, registro: null }],
      ventas_parciales: true,
    });
    expect(e.cliente.saldo_pendiente).toBe(2317);
    expect(e.ventas[0].total).toBe(99.5);
    expect(e.abonos[0].monto).toBe(10);
    expect(e.ventas_parciales).toBe(true);
  });

  it("sin ventas ni abonos, lista vacía", () => {
    const e = normalizarEstadoCuenta({ cliente: { id: "c", nombre: "Ana", saldo_pendiente: 0, limite_credito: null }, ventas: null, abonos: null });
    expect(movimientosDeCuenta(e)).toEqual([]);
    expect(e.cliente.limite_credito).toBe(0);
  });
});
