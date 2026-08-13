import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import {
  normalizeDataId,
  parseWebhookPayload,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago/webhook";

const buildSignature = (
  secret: string,
  dataId: string,
  xRequestId: string | null,
  ts: string
): string => {
  let manifest = `id:${normalizeDataId(dataId)};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
};

describe("normalizeDataId", () => {
  it("pasa a minusculas los ids alfanumericos (ordenes ORD...)", () => {
    expect(normalizeDataId("ORD1234ABCD")).toBe("ord1234abcd");
  });

  it("no altera ids que contienen guiones (uuids)", () => {
    expect(normalizeDataId("1a2b-3c4d")).toBe("1a2b-3c4d");
  });
});

describe("verifyMercadoPagoSignature", () => {
  const secret = "webhook_secret_test";
  const dataId = "ORD1234ABCD";
  const xRequestId = "req-abc-123";
  const ts = "1745000000";

  it("acepta una firma valida", () => {
    const signature = buildSignature(secret, dataId, xRequestId, ts);
    expect(
      verifyMercadoPagoSignature(secret, signature, xRequestId, dataId)
    ).toBe(true);
  });

  it("rechaza con secreto incorrecto", () => {
    const signature = buildSignature(secret, dataId, xRequestId, ts);
    expect(
      verifyMercadoPagoSignature("otro-secreto", signature, xRequestId, dataId)
    ).toBe(false);
  });

  it("rechaza cuando falta ts o v1", () => {
    expect(verifyMercadoPagoSignature(secret, "v1=abc", xRequestId, dataId)).toBe(
      false
    );
    expect(verifyMercadoPagoSignature(secret, "ts=123", xRequestId, dataId)).toBe(
      false
    );
  });

  it("rechaza cuando faltan headers o data id", () => {
    expect(verifyMercadoPagoSignature(secret, null, xRequestId, dataId)).toBe(
      false
    );
    expect(verifyMercadoPagoSignature(secret, "ts=1,v1=abc", null, undefined)).toBe(
      false
    );
  });

  it("rechaza firma para otro data id (manipulacion)", () => {
    const signature = buildSignature(secret, dataId, xRequestId, ts);
    expect(
      verifyMercadoPagoSignature(secret, signature, xRequestId, "ORD9999XXXX")
    ).toBe(false);
  });
});

describe("parseWebhookPayload", () => {
  it("devuelve el payload tal cual", () => {
    const payload = {
      action: "orders.created",
      type: "order",
      data: { id: "ORD1234ABCD" },
    };
    expect(parseWebhookPayload(payload)).toEqual(payload);
  });

  it("devuelve objeto vacio para valores nulos", () => {
    expect(parseWebhookPayload(null)).toEqual({});
    expect(parseWebhookPayload("texto")).toEqual({});
  });
});