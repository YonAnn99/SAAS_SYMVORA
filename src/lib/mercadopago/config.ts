export const MERCADO_PAGO_API_URL =
  process.env.MERCADO_PAGO_API_URL ?? "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "MercadoPagoError";
    this.status = status;
    this.code = code;
  }
}

export function mpHeaders(
  accessToken: string,
  idempotencyKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }
  return headers;
}

export async function mpFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MERCADO_PAGO_API_URL}${path}`, init);
  } catch (error) {
    throw new MercadoPagoError(
      error instanceof Error ? error.message : "No se pudo conectar con Mercado Pago",
      502
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
        cause?: unknown[];
      };
      detail =
        body.message ||
        body.error ||
        (Array.isArray(body.cause)
          ? JSON.stringify(body.cause[0])
          : "") ||
        "";
    } catch {
      // sin cuerpo JSON legible
    }
    throw new MercadoPagoError(
      detail || `Mercado Pago respondió con estado ${response.status}`,
      response.status
    );
  }

  return (await response.json()) as T;
}