import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const webhookSecret = process.env.CONEKTA_WEBHOOK_SECRET;

async function verifyWebhookSignature(request: Request): Promise<boolean> {
  if (!webhookSecret) return true;
  const signature = request.headers.get("x-conekta-signature");
  if (!signature) return false;

  const body = await request.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signature.includes(expectedSignature);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
