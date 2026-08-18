import type { Cliente, Producto } from "@/lib/types/database";

export type { Cliente, Producto };

export type UnidadMedida = "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";

export interface CartItem {
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  unidad_medida: UnidadMedida;
}

export interface SaleTotals {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

export type MetodoPago =
  | "EFECTIVO"
  | "TARJETA"
  | "TRANSFERENCIA"
  | "CREDITO"
  | "TARJETA_TERMINAL";

export type MetodoPagoDirecto = Exclude<MetodoPago, "TARJETA_TERMINAL">;

export type TerminalStatus =
  | "waiting"
  | "error"
  | "pagado"
  | "rechazada"
  | "cancelada"
  | "timeout"
  | null;

export interface TerminalOrderState {
  mpOrderId: string;
  monto: number;
}

export interface SaleReceipt {
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerName: string | null;
}