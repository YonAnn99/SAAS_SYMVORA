export interface TerminalOrderItemPayload {
  productId: string;
  varianteId: string | null;
  cantidad: number;
  descuento: number;
  /** Insumos ajustados en el POS (TOTALES de la linea); sin la clave, la receta. */
  insumos?: { productId: string; varianteId: string | null; cantidad: number }[];
}

export interface CreateTerminalOrderParams {
  tenantId: string;
  clienteId: string | null;
  items: TerminalOrderItemPayload[];
  /** Lista de precios con la que se calcula el monto a cobrar en el datafono. */
  listaPrecioId?: string | null;
  /** Lo que dice el carrito: la terminal cobra con o sin IVA igual que la pantalla. */
  includeIva: boolean;
}

export interface CreateTerminalOrderResponse {
  success: boolean;
  mp_order_id: string;
  monto: number;
}

export interface TerminalOrderStatusResponse {
  success: boolean;
  estado: string;
  venta_id: string | null;
  monto: number;
}

export interface CancelTerminalOrderResponse {
  success: boolean;
  pagado: boolean;
  message?: string;
  /**
   * Mercado Pago no dejo cancelar: el cobro ya esta en la terminal. Se cancela
   * ahi y el webhook lo avisa; mientras, el punto de venta sigue esperando.
   */
  enTerminal?: boolean;
}

export interface MercadoPagoPointConfig {
  habilitado: boolean;
  terminal_id: string;
  access_token_id: string;
  webhook_secret_id: string;
}

export interface ResolvedMercadoPagoSecrets {
  accessToken: string;
  webhookSecret: string;
}