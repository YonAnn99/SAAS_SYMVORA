import type { Cliente, Producto } from "@/lib/types/database";

export type { Cliente, Producto };

export type UnidadMedida = "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";

export interface CartItem {
  productId: string;
  /**
   * Variante vendida (talla/color). `null` = venta "general", del stock sin
   * clasificar del producto.
   *
   * Forma parte de la IDENTIDAD de la línea: dos tallas del mismo producto son
   * dos líneas distintas del carrito, con su propio precio y su propio stock.
   */
  varianteId: string | null;
  /** Etiqueta legible de la variante ("M · ROJO"), solo para mostrar. */
  varianteLabel?: string | null;
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
  customerPhone?: string | null;
  montoRecibido?: number | null;
  cambio?: number | null;
}

/** Variante tal como la necesita el POS (subconjunto de `variantes_producto`). */
export interface VarianteProducto {
  id: string;
  producto_id: string;
  talla: string | null;
  color: string | null;
  precio_venta: number;
  stock_actual: number;
}
