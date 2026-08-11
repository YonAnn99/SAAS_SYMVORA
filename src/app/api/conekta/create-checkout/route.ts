import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createHostedCheckoutOrder } from "@/lib/conekta/orders";

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

    const supabase = createSupabaseServiceRoleClient();

    // Get subscription and tenant info
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("conekta_customer_id, status")
      .eq("tenant_id", tenant_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // If no Conekta customer yet, we need to create one
    if (!subscription.conekta_customer_id) {
      // Get tenant info for customer creation
      const { data: tenant } = await supabase
        .from("tenants")
        .select("nombre_comercial, email")
        .eq("id", tenant_id)
        .single();

      const { createCustomer } = await import("@/lib/conekta/customers");
      const customerId = await createCustomer({
        name: tenant?.nombre_comercial || "SYMVORA User",
        email: tenant?.email || "user@symvora.com",
      });

      // Update subscription with customer ID
      await supabase
        .from("subscriptions")
        .update({ conekta_customer_id: customerId })
        .eq("tenant_id", tenant_id);

      subscription.conekta_customer_id = customerId;
    }

    // Determine allowed payment methods based on type
    const allowedMethods =
      type === "oxxo"
        ? ["cash", "card", "bank_transfer"]
        : ["card", "cash", "bank_transfer"];

    // Create hosted checkout order
    const order = await createHostedCheckoutOrder({
      customerId: subscription.conekta_customer_id,
      amount: 40000, // $400 MXN in centavos
      description: "SYMVORA Basico - Mensual",
      successUrl: `${APP_URL}/es/billing/success`,
      cancelUrl: `${APP_URL}/es/billing`,
      failureUrl: `${APP_URL}/es/billing`,
      allowedPaymentMethods: allowedMethods,
    });

    // Get checkout URL from response
    const orderData = order as Record<string, unknown>;
    const checkout = orderData.checkout as Record<string, unknown> | undefined;
    const checkoutUrl = checkout?.url as string | undefined;

    if (!checkoutUrl) {
      console.error("No checkout URL in response:", order);
      return NextResponse.json(
        { error: "Failed to create checkout" },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error("Error creating checkout:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
