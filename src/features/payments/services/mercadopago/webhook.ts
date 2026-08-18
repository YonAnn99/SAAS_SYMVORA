import { createHmac, timingSafeEqual } from "crypto";

export interface MpWebhookPayload {
  action?: string;
  type?: string;
  data?: {
    id?: string;
  };
  id?: string;
}

export function normalizeDataId(dataId: string): string {
  // Los IDs alfanumericos (p.ej. ordenes "ORD...") se comparan en minusculas.
  if (/^[a-zA-Z0-9]+$/.test(dataId)) return dataId.toLowerCase();
  return dataId;
}

export function verifyMercadoPagoSignature(
  secret: string,
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | undefined
): boolean {
  if (!secret || !xSignature || !dataId) return false;

  const parts = xSignature.split(",").map((part) => part.trim());
  const tsPart = parts.find((part) => part.startsWith("ts="));
  const v1Part = parts.find((part) => part.startsWith("v1="));
  if (!tsPart || !v1Part) return false;

  const ts = tsPart.slice(3);
  const v1 = v1Part.slice(3);

  const normalizedId = normalizeDataId(dataId);

  let manifest = `id:${normalizedId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(v1, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function parseWebhookPayload(raw: unknown): MpWebhookPayload {
  if (typeof raw !== "object" || raw === null) return {};
  return raw as MpWebhookPayload;
}