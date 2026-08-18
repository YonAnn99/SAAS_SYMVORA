import type {
  CancelTerminalOrderResponse,
  CreateTerminalOrderParams,
  CreateTerminalOrderResponse,
  TerminalOrderStatusResponse,
} from "@/features/payments/types/payments.types";

export type {
  CancelTerminalOrderResponse,
  CreateTerminalOrderParams,
  CreateTerminalOrderResponse,
  TerminalOrderItemPayload,
  TerminalOrderStatusResponse,
} from "@/features/payments/types/payments.types";

export async function createTerminalOrder(
  params: CreateTerminalOrderParams
): Promise<CreateTerminalOrderResponse> {
  const response = await fetch("/api/mercadopago/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      cliente_id: params.clienteId,
      items: params.items,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Error al iniciar el cobro con terminal");
  }
  return data as CreateTerminalOrderResponse;
}

export async function getTerminalOrderStatus(
  tenantId: string,
  mpOrderId: string
): Promise<TerminalOrderStatusResponse> {
  const searchParams = new URLSearchParams({
    tenant_id: tenantId,
    mp_order_id: mpOrderId,
  });
  const response = await fetch(
    `/api/mercadopago/order-status?${searchParams.toString()}`
  );
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Error consultando el estado del cobro");
  }
  return data as TerminalOrderStatusResponse;
}

export async function cancelTerminalOrder(
  tenantId: string,
  mpOrderId: string
): Promise<CancelTerminalOrderResponse> {
  const response = await fetch("/api/mercadopago/cancel-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId, mp_order_id: mpOrderId }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Error al cancelar el cobro");
  }
  return data as CancelTerminalOrderResponse;
}