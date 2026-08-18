export interface TerminalOrderItemPayload {
  productId: string;
  cantidad: number;
  descuento: number;
}

export interface CreateTerminalOrderParams {
  tenantId: string;
  clienteId: string | null;
  items: TerminalOrderItemPayload[];
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