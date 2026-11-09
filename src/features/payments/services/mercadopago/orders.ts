import { mpFetch, mpHeaders } from "./config";

export interface CreateOrderParams {
  accessToken: string;
  terminalId: string;
  amount: number;
  externalReference: string;
  description?: string;
  expirationSeconds?: number;
  idempotencyKey?: string;
}

export interface MpOrderPayment {
  id?: string;
  amount?: string;
  status?: string;
  status_detail?: string;
}

export interface MpOrder {
  id: string;
  type?: string;
  user_id?: string;
  external_reference?: string;
  description?: string;
  status: string;
  status_detail?: string;
  created_date?: string;
  last_updated_date?: string;
  transactions?: {
    payments?: MpOrderPayment[];
  };
}

const DEFAULT_EXPIRATION_SECONDS = 120;

export async function createOrder(params: CreateOrderParams): Promise<MpOrder> {
  const body = {
    type: "point",
    external_reference: params.externalReference,
    expiration_time: `PT${params.expirationSeconds ?? DEFAULT_EXPIRATION_SECONDS}S`,
    transactions: {
      payments: [{ amount: params.amount.toFixed(2) }],
    },
    config: {
      point: {
        terminal_id: params.terminalId,
        // El comprobante de pago lo imprime la terminal (en modo PDV es el
        // valor por defecto de Mercado Pago). Con `no_ticket` no salia nada.
        print_on_terminal: "seller_ticket",
      },
      payment_method: {
        default_type: "credit_card",
      },
    },
    description: params.description ?? "Venta SYMVORA",
  };

  return mpFetch<MpOrder>("/v1/orders", {
    method: "POST",
    headers: mpHeaders(
      params.accessToken,
      params.idempotencyKey ?? crypto.randomUUID()
    ),
    body: JSON.stringify(body),
  });
}

export async function getOrder(
  accessToken: string,
  orderId: string
): Promise<MpOrder> {
  return mpFetch<MpOrder>(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: mpHeaders(accessToken),
  });
}

export async function cancelOrder(
  accessToken: string,
  orderId: string,
  idempotencyKey?: string
): Promise<MpOrder> {
  return mpFetch<MpOrder>(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    // Sin este header, una orden que ya esta en la terminal (`at_terminal`) no
    // se puede cancelar por API: Mercado Pago responde 409 cannot_cancel_order.
    // Con el, responde 202 y la terminal cancela (Point Smart con software al
    // dia); la confirmacion llega por webhook o por la consulta del POS.
    headers: mpHeaders(accessToken, idempotencyKey ?? crypto.randomUUID(), {
      "x-allow-cancelable-status": "at_terminal",
    }),
  });
}

export interface MpTerminal {
  id: string;
  operating_mode?: string;
  description?: string;
  model?: string;
  serial_number?: string;
}

export async function listTerminals(
  accessToken: string
): Promise<MpTerminal[]> {
  const data = await mpFetch<{ data?: { terminals?: MpTerminal[] } }>(
    "/terminals/v1/list",
    {
      method: "GET",
      headers: mpHeaders(accessToken),
    }
  );
  return data?.data?.terminals ?? [];
}

export async function setTerminalOperatingMode(
  accessToken: string,
  terminalId: string,
  operatingMode = "PDV"
): Promise<void> {
  await mpFetch<unknown>("/terminals/v1/setup", {
    method: "PATCH",
    headers: mpHeaders(accessToken, crypto.randomUUID()),
    body: JSON.stringify({
      terminals: [{ id: terminalId, operating_mode: operatingMode }],
    }),
  });
}