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
      case "subscription.created":
      case "subscription.paid": {
        const customerId = data.customer_id;
        const subscriptionId = data.id;

        const { error: subError } = await supabase
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

        if (subError) {
          console.error("Error updating subscription:", subError);
        }

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

        await supabase
          .from("tenants")
          .update({ subscription_status: "active" })
          .eq("id", (
            await supabase
              .from("subscriptions")
              .select("tenant_id")
              .eq("conekta_customer_id", customerId)
              .single()
          )?.data?.tenant_id);

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
          .select("id, tenant_id")
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
