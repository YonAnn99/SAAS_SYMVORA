import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const conektaWebhookPublicKey = process.env.CONEKTA_WEBHOOK_PUBLIC_KEY;
const legacyWebhookSecret = process.env.CONEKTA_WEBHOOK_SECRET;

function extractDigestBase64(digestHeader: string | null): Buffer | null {
  if (!digestHeader) return null;

  let value = digestHeader.trim();
  for (const marker of ["sha-256=:", "sha-256=", "sha256=:", "sha256="]) {
    if (value.startsWith(marker)) {
      value = value.slice(marker.length);
      break;
    }
  }

  value = value.trim();
  if (value.startsWith(":")) value = value.slice(1);
  if (value.endsWith(":")) value = value.slice(0, -1);

  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

async function verifyConektaSignature(rawBody: string, digestHeader: string | null): Promise<boolean> {
  if (!conektaWebhookPublicKey) {
    console.error(
      "[conekta-webhook] CONEKTA_WEBHOOK_PUBLIC_KEY not configured; rejecting webhook. " +
        "Generate keys via POST https://api.conekta.io/webhook_keys"
    );
    return false;
  }

  if (legacyWebhookSecret) {
    console.warn(
      "[conekta-webhook] CONEKTA_WEBHOOK_SECRET (HMAC) is obsolete; Conekta signs webhooks " +
        "with RSA using the DIGEST header. Set CONEKTA_WEBHOOK_PUBLIC_KEY instead."
    );
  }

  const signature = extractDigestBase64(digestHeader);
  if (!signature || signature.length === 0) {
    console.error("[conekta-webhook] Missing or malformed DIGEST header");
    return false;
  }

  try {
    return crypto.verify(
      "sha256",
      Buffer.from(rawBody, "utf8"),
      conektaWebhookPublicKey,
      signature
    );
  } catch (verifyError) {
    console.error("[conekta-webhook] RSA verification failed:", verifyError);
    return false;
  }
}

// ============================================================
// Programa de referidos — helpers
// ============================================================

// Otorga la recompensa solo cuando el referido llega a su PRIMER pago real.
// - Estado REGISTRADO => CONVERTIDO (idempotente: solo una vez).
// - Anti-fraude server-side: el referidor debe tener (o haber tenido) una
//   suscripcion active legitima antes de recibir el credito. La UI que oculta
//   el codigo en trial es cosmética, esta validacion es la proteccion real.
async function convertReferralOnFirstPayment(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<{ converted: boolean; reason?: string }> {
  const { data: referral } = await supabase
    .from("referidos")
    .select("id, tenant_referidor_id")
    .eq("tenant_referido_id", tenantId)
    .eq("estado", "REGISTRADO")
    .maybeSingle();

  if (!referral) {
    return { converted: false, reason: "no_referral" };
  }

  // Anti-fraude: el referidor debe tener o haber tenido suscripcion activa.
  const { data: referrerSub } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("tenant_id", referral.tenant_referidor_id)
    .maybeSingle();

  let referrerEligible = referrerSub?.status === "active";

  if (!referrerEligible && referrerSub?.id) {
    const { data: paidRow } = await supabase
      .from("payment_history")
      .select("id")
      .eq("subscription_id", referrerSub.id)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    referrerEligible = Boolean(paidRow);
  }

  if (!referrerEligible) {
    return { converted: false, reason: "referrer_not_eligible" };
  }

  // Marca CONVERTIDO y otorga +1 mes gratis a ambos lados (atómico via RPC).
  await supabase
    .from("referidos")
    .update({ estado: "CONVERTIDO", convertido_en: new Date().toISOString() })
    .eq("id", referral.id);

  await supabase.rpc("incrementar_credito_referido", {
    p_tenant_id: tenantId,
  });
  await supabase.rpc("incrementar_credito_referido", {
    p_tenant_id: referral.tenant_referidor_id,
  });

  return { converted: true };
}

// Consume un mes gratis acumulado sobre un cobro recurrente real:
// decrementa el credito, registra el mes 'credited' y reembolsa la orden en
// Conekta. Idempotente via conekta_order_id + status 'credited'.
async function consumeFreeMonthCredit(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  params: {
    subscriptionId: string;
    tenantId: string;
    conektaOrderId: string;
    amountCents: number;
  }
): Promise<{ consumed: boolean; reason?: string }> {
  const { subscriptionId, tenantId, conektaOrderId, amountCents } = params;

  const { data: existing } = await supabase
    .from("payment_history")
    .select("id")
    .eq("conekta_order_id", conektaOrderId)
    .eq("status", "credited")
    .maybeSingle();

  if (existing) {
    return { consumed: false, reason: "already_processed" };
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("creditos_mes_gratis")
    .eq("id", subscriptionId)
    .single();

  const credits = sub?.creditos_mes_gratis ?? 0;
  if (credits <= 0) {
    return { consumed: false, reason: "no_credit" };
  }

  // 1. Decrementa el credito.
  await supabase
    .from("subscriptions")
    .update({ creditos_mes_gratis: credits - 1 })
    .eq("id", subscriptionId);

  // 2. Registra el mes como 'credited' (trazable en el historial).
  await supabase.from("payment_history").insert({
    subscription_id: subscriptionId,
    amount: 0,
    payment_method: "card",
    status: "credited",
    reference: "referido",
    conekta_order_id: conektaOrderId,
    paid_at: new Date().toISOString(),
  });

  // 3. Reembolsa el cobro en Conekta (best-effort: si falla el reembolso, el
  //    credito ya fue consumido y queda registrado para soporte manual).
  try {
    const { refundOrder } = await import("@/lib/conekta/orders");
    await refundOrder({
      orderId: conektaOrderId,
      amountCents,
      reason: "Mes gratis programa de referidos",
    });
  } catch (refundError) {
    console.error(
      `[conekta-webhook] Refund failed for order ${conektaOrderId} (tenant ${tenantId}):`,
      refundError
    );
  }

  return { consumed: true };
}

// Email de bienvenida al dueño del tenant que acaba de pagar su membresia.
async function sendWelcomeEmailToOwner(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string
): Promise<void> {
  try {
    const { data: owner } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "ORG_ADMIN")
      .limit(1)
      .maybeSingle();

    if (!owner) return;

    const { data: user } = await supabase.auth.admin.getUserById(owner.user_id);
    const email = user?.user?.email;
    if (!email) return;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("nombre_comercial, codigo_referido")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) return;

    const { sendWelcomeEmail } = await import("@/lib/email");
    await sendWelcomeEmail({
      to: email,
      businessName: tenant.nombre_comercial || "tu negocio",
      referralCode: tenant.codigo_referido,
    });
  } catch (emailError) {
    console.error("[conekta-webhook] Failed to send welcome email:", emailError);
  }
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const digestHeader = request.headers.get("digest");

    if (!(await verifyConektaSignature(rawBody, digestHeader))) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type;
    const data = body.data?.object;

    if (!data) {
      return NextResponse.json({ received: true });
    }

    const supabase = createSupabaseServiceRoleClient();

    switch (eventType) {
      case "subscription.created": {
        const customerId = data.customer_id;
        const subscriptionId = data.id;

        // Nota: NO se fija last_payment_at aqui — solo lo hace un pago real
        // (order.paid / subscription.paid). La conversion del referido se
        // dispara con la guardia "last_payment_at IS NULL".
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            conekta_subscription_id: subscriptionId,
            current_period_start: data.billing_cycle_start
              ? new Date(data.billing_cycle_start * 1000).toISOString()
              : null,
            current_period_end: data.billing_cycle_end
              ? new Date(data.billing_cycle_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (sub) {
          await supabase.from("payment_history").insert({
            subscription_id: sub.id,
            amount: (data.amount || 40000) / 100,
            payment_method: "card",
            status: "completed",
            conekta_order_id: data.last_billing_cycle_order_id,
            paid_at: new Date().toISOString(),
          });
        }

        const { data: tenantSub } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (tenantSub?.tenant_id) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "active" })
            .eq("id", tenantSub.tenant_id);
        }

        break;
      }

      case "subscription.paid": {
        const customerId = data.customer_id;
        const subscriptionId = data.id;

        // Lee el estado ANTES de actualizar para saber si es el primer pago.
        const { data: preSub } = await supabase
          .from("subscriptions")
          .select("id, tenant_id, last_payment_at")
          .eq("conekta_customer_id", customerId)
          .maybeSingle();

        const isFirstPayment = !preSub?.last_payment_at;

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            conekta_subscription_id: subscriptionId,
            current_period_start: data.billing_cycle_start
              ? new Date(data.billing_cycle_start * 1000).toISOString()
              : null,
            current_period_end: data.billing_cycle_end
              ? new Date(data.billing_cycle_end * 1000).toISOString()
              : null,
            last_payment_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        if (preSub) {
          await supabase.from("payment_history").insert({
            subscription_id: preSub.id,
            amount: (data.amount || 40000) / 100,
            payment_method: "card",
            status: "completed",
            conekta_order_id: data.last_billing_cycle_order_id,
            paid_at: new Date().toISOString(),
          });
        }

        if (preSub?.tenant_id) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "active" })
            .eq("id", preSub.tenant_id);
        }

        if (preSub) {
          if (isFirstPayment) {
            // Primer pago real => conversion del referido (si aplica).
            await convertReferralOnFirstPayment(supabase, preSub.tenant_id);
          } else if (data.last_billing_cycle_order_id) {
            // Cobro recurrente real => aplicar mes gratis acumulado.
            await consumeFreeMonthCredit(supabase, {
              subscriptionId: preSub.id,
              tenantId: preSub.tenant_id,
              conektaOrderId: data.last_billing_cycle_order_id,
              amountCents: data.amount || 40000,
            });
          }
        }

        break;
      }

      case "subscription.payment_failed": {
        const customerId = data.customer_id;

        await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (subData) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "past_due" })
            .eq("id", subData.tenant_id);
        }

        break;
      }

      case "subscription.canceled": {
        const customerId = data.customer_id;

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("conekta_customer_id", customerId);

        const { data: cancelData } = await supabase
          .from("subscriptions")
          .select("tenant_id")
          .eq("conekta_customer_id", customerId)
          .single();

        if (cancelData) {
          await supabase
            .from("tenants")
            .update({ subscription_status: "canceled" })
            .eq("id", cancelData.tenant_id);
        }

        break;
      }

      case "order.paid": {
        const customerId = data.customer?.id;
        if (!customerId) break;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id, tenant_id, last_payment_at")
          .eq("conekta_customer_id", customerId)
          .single();

        if (subData) {
          await supabase.from("payment_history").insert({
            subscription_id: subData.id,
            amount: (data.amount || 0) / 100,
            payment_method: "card",
            status: "completed",
            conekta_order_id: data.id,
            paid_at: new Date().toISOString(),
          });

          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              last_payment_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", subData.id);

          await supabase
            .from("tenants")
            .update({ subscription_status: "active" })
            .eq("id", subData.tenant_id);

          // El checkout hosted es el pago real del flujo: el primer pago
          // dispara la conversion del referido y el email de bienvenida;
          // los pagos siguientes consumen un mes gratis acumulado (si aplica).
          if (!subData.last_payment_at) {
            await convertReferralOnFirstPayment(supabase, subData.tenant_id);
            await sendWelcomeEmailToOwner(supabase, subData.tenant_id);
          } else {
            await consumeFreeMonthCredit(supabase, {
              subscriptionId: subData.id,
              tenantId: subData.tenant_id,
              conektaOrderId: data.id,
              amountCents: data.amount || 40000,
            });
          }
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}