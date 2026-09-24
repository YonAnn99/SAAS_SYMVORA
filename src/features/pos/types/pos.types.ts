import type { Cliente, Producto } from "@/lib/types/database";

export type { Cliente, Producto };

// Fuente unica en `@/lib/unidades` (migracion 090 agrego metro, caja, par...).
export type { UnidadMedida } from "@/lib/unidades";
import type { UnidadMedida } from "@/lib/unidades";

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
  /**
   * Referencia que imprime el ticket como numero de operacion.
   *
   * Online es el `id` de `ventas`; sin conexion esa fila todavia no existe y se
   * usa la clave de idempotencia, que es con la que el servidor deduplica al
   * sincronizar — asi que sigue apuntando a la misma venta cuando suba.
   */
  reference?: string | null;
  /**
   * Cuando se cobro. Solo lo trae una REIMPRESION.
   *
   * En el cobro normal se omite y el ticket usa la hora actual, que es la
   * correcta. Al reimprimir una venta vieja hay que pasarla, o el papel
   * mentiria diciendo que se cobro hoy.
   */
  fecha?: Date | null;
  /** Quien cobro. El ticket del POS no lo traia; la reimpresion si. */
  cajero?: string | null;
  /**
   * Marca el papel como copia.
   *
   * Un ticket reimpreso sin distintivo sirve para justificar una devolucion
   * falsa: es practica estandar en punto de venta diferenciarlo del original.
   */
  esReimpresion?: boolean;
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
