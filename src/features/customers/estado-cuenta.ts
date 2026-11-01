/**
 * Estado de cuenta de un cliente (migracion 129, `estado_cuenta_cliente`): sus
 * ventas a credito y sus abonos en una sola lista. Puro, con test.
 */

export interface VentaFiada {
  id: string;
  fecha: string;
  total: number;
  /** `estado_venta`: una venta cancelada sale tachada y no suma. */
  estado: string;
  cajero: string | null;
  sucursal: string | null;
}

export interface Abono {
  id: string;
  fecha: string;
  monto: number;
  metodo_pago: string;
  notas: string | null;
  registro: string | null;
}

export interface EstadoCuenta {
  cliente: { id: string; nombre: string; saldo_pendiente: number; limite_credito: number };
  ventas: VentaFiada[];
  abonos: Abono[];
  /** Sin `sales.view_all` solo llegan las ventas que registro esta persona. */
  ventas_parciales: boolean;
}

export type MovimientoCuenta =
  | { tipo: "venta"; fecha: string; venta: VentaFiada }
  | { tipo: "abono"; fecha: string; abono: Abono };

/** Ventas y abonos mezclados, lo mas reciente primero. */
export function movimientosDeCuenta(estado: Pick<EstadoCuenta, "ventas" | "abonos">): MovimientoCuenta[] {
  const movimientos: MovimientoCuenta[] = [
    ...estado.ventas.map((venta) => ({ tipo: "venta" as const, fecha: venta.fecha, venta })),
    ...estado.abonos.map((abono) => ({ tipo: "abono" as const, fecha: abono.fecha, abono })),
  ];
  return movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

/** Lo que llega del RPC trae los importes como texto (numeric): a numero. */
export function normalizarEstadoCuenta(crudo: unknown): EstadoCuenta {
  const e = crudo as EstadoCuenta;
  return {
    cliente: {
      ...e.cliente,
      saldo_pendiente: Number(e.cliente.saldo_pendiente),
      limite_credito: Number(e.cliente.limite_credito ?? 0),
    },
    ventas: (e.ventas ?? []).map((v) => ({ ...v, total: Number(v.total) })),
    abonos: (e.abonos ?? []).map((a) => ({ ...a, monto: Number(a.monto) })),
    ventas_parciales: Boolean(e.ventas_parciales),
  };
}
