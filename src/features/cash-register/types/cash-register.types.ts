import type {
  Caja,
  EstadoCaja,
  MovimientoCaja,
} from "@/lib/types/database";

export type { Caja, EstadoCaja, MovimientoCaja };

export type TipoMovimientoCaja = MovimientoCaja["tipo"];

export interface CashRegisterSummary {
  activeRegister: Caja | null;
  movements: MovimientoCaja[];
  totalVentas: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoEsperado: number;
}

export interface CloseRegisterPayload {
  saldoReal: number;
  notasCierre: string;
}