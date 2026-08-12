import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://saas-symvora.vercel.app";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, type } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    if (!process.env.CONEKTA_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "CONEKTA_PRIVATE_KEY not configured" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    // Get subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("conekta_customer_id, status")
      .eq("tenant_id", tenant_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: `No subscription found for tenant: ${subError?.message || "not found"}` },
        { status: 404 }
      );
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("nombre_comercial, email, telefono")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: `No tenant found: ${tenantError?.message || "not found"}` },
        { status: 404 }
      );
    }

    // Create Conekta customer if needed
    let customerId = subscription.conekta_customer_id;
    if (!customerId) {
      try {
        const { createCustomer } = await import("@/lib/conekta/customers");
        customerId = await createCustomer({
          name: tenant.nombre_comercial || "SYMVORA User",
          email: tenant.email || "user@symvora.com",
          // Conekta requires `phone` (it's not marked optional in their
          // schema) — sending "" is what caused the 422. `telefono` isn't
          // captured anywhere in signup yet, so fall back to a
          // placeholder valid-format number until that's added.
          phone: tenant.telefono || "5555555555",
        });

        await supabase
          .from("subscriptions")
          .update({ conekta_customer_id: customerId })
          .eq("tenant_id", tenant_id);
      } catch (customerError: unknown) {
        // Axios errors carry the real validation detail in
        // error.response.data — the generic .message is just "Request
        // failed with status code 422" and hides which field failed.
        const errObj = customerError as {
          response?: { data?: unknown; status?: number };
          message?: string;
        };
        const detail = errObj.response?.data
          ? JSON.stringify(errObj.response.data)
          : errObj.message || String(customerError);
        console.error("Error creating Conekta customer:", detail);
        return NextResponse.json(
          { error: `Error creating customer: ${detail}` },
          { status: 500 }
        );
      }
    }

    // Determine allowed payment methods
    const allowedMethods =
      type === "oxxo"
        ? ["cash", "card", "bank_transfer"]
        : ["card", "cash", "bank_transfer"];

    // Create hosted checkout order
    let order;
    try {
      const { createHostedCheckoutOrder } = await import("@/lib/conekta/orders");
      order = await createHostedCheckoutOrder({
        customerId: customerId!,
        amount: 40000,
        description: "SYMVORA Basico - Mensual",
        successUrl: `${APP_URL}/es/billing/success`,
        cancelUrl: `${APP_URL}/es/billing`,
        failureUrl: `${APP_URL}/es/billing`,
        allowedPaymentMethods: allowedMethods,
      });
    } catch (orderError: unknown) {
      const msg = orderError instanceof Error ? orderError.message : String(orderError);
      console.error("Error creating Conekta order:", msg);
      return NextResponse.json(
        { error: `Error creating order: ${msg}` },
        { status: 500 }
      );
    }

    // Get checkout URL
    const orderData = order as Record<string, unknown>;
    const checkout = orderData.checkout as Record<string, unknown> | undefined;
    const checkoutUrl = checkout?.url as string | undefined;

    if (!checkoutUrl) {
      console.error("No checkout URL in response:", JSON.stringify(order));
      return NextResponse.json(
        { error: "Checkout created but no URL returned. Response: " + JSON.stringify(checkout || orderData).slice(0, 500) },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkout_url: checkoutUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error creating checkout:", msg);
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 }
    );
  }
}
