import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { getOrder } from "@/lib/mercadopago/orders";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
} from "@/lib/mercadopago/secrets";
import {
  parseWebhookPayload,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let payload: ReturnType<typeof parseWebhookPayload>;
    try {
      payload = parseWebhookPayload(await request.json());
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (payload.type && payload.type !== "order") {
      return NextResponse.json({ ok: true });
    }

    const dataId = payload.data?.id ?? payload.id;
    if (!dataId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data: pago } = await supabase
      .from("pagos_terminal")
      .select("id, tenant_id, estado, venta_id")
      .eq("mp_order_id", dataId)
      .single();

    if (!pago) {
      // Orden desconocida: responder 200 para evitar reintentos infinitos
      console.warn("Webhook Mercado Pago de orden desconocida:", dataId);
      return NextResponse.json({ ok: true });
    }

    const config = await getMercadoPagoPointConfig(pago.tenant_id);
    const secrets = await readMercadoPagoSecrets(pago.tenant_id, config);

    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const valid = verifyMercadoPagoSignature(
      secrets.webhookSecret,
      xSignature,
      xRequestId,
      dataId
    );

    if (!valid) {
      return NextResponse.json(
        { error: "Firma inválida" },
        { status: 401 }
      );
    }

    // Estado autoritativo de la orden: se consulta a Mercado Pago
    let paid = false;
    let status = "unknown";
    if (secrets.accessToken) {
      try {
        const order = await getOrder(secrets.accessToken, dataId);
        status = order.status ?? "unknown";
        paid = status === "processed";
      } catch (error) {
        console.error("Error consultando orden Mercado Pago:", error);
      }
    } else {
      // Sin access token, se usa la accion del webhook como fallback
      const action = payload.action ?? "";
      if (action.includes("processed")) {
        paid = true;
        status = "processed";
      } else if (action.includes("failed") || action.includes("canceled")) {
        status = action.includes("canceled") ? "canceled" : "failed";
      }
    }

    const { error: rpcError } = await supabase.rpc(
      "confirm_terminal_payment",
      {
        p_mp_order_id: dataId,
        p_pagado: paid,
        p_estado: paid ? "processed" : status === "unknown" ? null : status,
      }
    );

    if (rpcError) {
      console.error("Error confirmando pago de terminal:", rpcError);
      return NextResponse.json(
        { error: "No se pudo confirmar el pago" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook Mercado Pago error:", error);
    // Responder 200 para evitar reintentos en errores no criticos
    return NextResponse.json({ ok: true });
  }
}