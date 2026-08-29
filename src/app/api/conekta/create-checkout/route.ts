import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.symvora.com.mx";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, type } = body;
    const locale = typeof body.locale === "string" && /^(es|en)$/.test(body.locale)
      ? body.locale
      : "es";

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, { tenantId: tenant_id });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

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
        // Usar el correo de login del superadmin (dueño del tenant) para
        // que las notificaciones de Conekta (referencia de pago, etc.)
        // lleguen a la cuenta con la que inicia sesión, no al email de
        // contacto de negocio (tenants.email) que es texto libre/opcional.
        const { data: ownerMembership } = await supabase
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenant_id)
          .eq("role", "SUPER_ADMIN")
          .limit(1)
          .maybeSingle();

        let ownerEmail: string | null = null;
        if (ownerMembership) {
          const { data: ownerUser } = await supabase.auth.admin.getUserById(
            ownerMembership.user_id
          );
          ownerEmail = ownerUser?.user?.email ?? null;
        }

        const { createCustomer } = await import("@/features/payments/services/conekta/customers");
        customerId = await createCustomer({
          name: tenant.nombre_comercial || "SYMVORA User",
          email: ownerEmail || tenant.email || "user@symvora.com",
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

    // Determine allowed payment methods (Conekta v2.3 current methods)
    const ALL_METHODS: string[] = [
      "card",
      "cash",
      "bank_transfer",
      "bnpl",
      "pay_by_bank",
      "apple",
      "google",
    ];

    const METHOD_MAP: Record<string, string[]> = {
      card: ["card", "apple", "google"],
      cash: ["cash"],
      bank_transfer: ["bank_transfer", "pay_by_bank"],
    };

    const allowedMethods = METHOD_MAP[type] ?? ALL_METHODS;

    // Create hosted checkout order
    let order;
    try {
      const { createHostedCheckoutOrder } = await import("@/features/payments/services/conekta/orders");
      order = await createHostedCheckoutOrder({
        customerId: customerId!,
        amount: 40000,
        description: "SYMVORA Basico - Mensual",
        successUrl: `${APP_URL}/${locale}/billing/success`,
        cancelUrl: `${APP_URL}/${locale}/billing`,
        failureUrl: `${APP_URL}/${locale}/billing`,
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
