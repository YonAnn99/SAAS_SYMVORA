import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { getAppUrl } from "@/lib/site";

const APP_URL = getAppUrl();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, type } = body;
    const locale = typeof body.locale === "string" && /^(es|en)$/.test(body.locale)
      ? body.locale
      : "es";
    const period = body.period === "yearly" ? "yearly" : "monthly";

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
      .select("id, conekta_customer_id, status")
      .eq("tenant_id", tenant_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: `No subscription found for tenant: ${subError?.message || "not found"}` },
        { status: 404 }
      );
    }

    await supabase
      .from("subscriptions")
      .update({ billing_period: period })
      .eq("id", subscription.id);

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
        let ownerName: string | null = null;
        if (ownerMembership) {
          const { data: ownerUser } = await supabase.auth.admin.getUserById(
            ownerMembership.user_id
          );
          ownerEmail = ownerUser?.user?.email ?? null;
          ownerName = (ownerUser?.user?.user_metadata?.nombre as string | undefined) ?? null;
        }

        // Conekta rechaza el "name" del cliente si no parece un nombre de
        // persona (rechaza dígitos y símbolos, ej. "01232ts" -> 422
        // conekta.errors.parameter_validation.name.invalid). nombre_comercial
        // es texto libre del negocio y puede ser cualquier cosa, así que se
        // prioriza el nombre real del dueño y se sanea el resultado.
        const sanitizeConektaName = (value: string | null | undefined): string => {
          const cleaned = (value || "")
            .replace(/[^\p{L}\s]/gu, "")
            .replace(/\s+/g, " ")
            .trim();
          return cleaned.length >= 2 ? cleaned : "";
        };
        const customerName =
          sanitizeConektaName(ownerName) ||
          sanitizeConektaName(tenant.nombre_comercial) ||
          "SYMVORA User";

        const { createCustomer } = await import("@/features/payments/services/conekta/customers");
        customerId = await createCustomer({
          name: customerName,
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

    // Monto en centavos: mensual $400 MXN, anual $320 MXN/mes facturado de
    // una vez ($320 x 12 = $3,840 MXN, 20% de ahorro vs pagar mes a mes).
    const amount = period === "yearly" ? 384000 : 40000;
    const description =
      period === "yearly" ? "SYMVORA Basico - Anual" : "SYMVORA Basico - Mensual";

    // Tarjeta = cobro recurrente real (Conekta solo soporta suscripciones con
    // tarjeta): en vez de una orden de una sola exhibición, se crea el checkout
    // con un plan — Conekta guarda la tarjeta y cobra sola cada periodo.
    // Efectivo no puede ser recurrente, así que sigue siendo una orden única.
    const isCardSubscription = type === "card";

    let order;
    try {
      if (isCardSubscription) {
        const { ensurePlanExists } = await import("@/features/payments/services/conekta/plans");
        const { createSubscriptionCheckout } = await import("@/features/payments/services/conekta/orders");
        const planId = await ensurePlanExists(period);
        order = await createSubscriptionCheckout({
          customerId: customerId!,
          planId,
          successUrl: `${APP_URL}/${locale}/billing/success?type=card`,
          cancelUrl: `${APP_URL}/${locale}/billing`,
          failureUrl: `${APP_URL}/${locale}/billing`,
        });
      } else {
        const { createHostedCheckoutOrder } = await import("@/features/payments/services/conekta/orders");
        order = await createHostedCheckoutOrder({
          customerId: customerId!,
          amount,
          description,
          successUrl: `${APP_URL}/${locale}/billing/success?type=${encodeURIComponent(type || "cash")}`,
          cancelUrl: `${APP_URL}/${locale}/billing`,
          failureUrl: `${APP_URL}/${locale}/billing`,
          allowedPaymentMethods: allowedMethods,
        });
      }
    } catch (orderError: unknown) {
      // Mismo caso que la creación de cliente: el .message de axios solo dice
      // "Request failed with status code 422" — el detalle real (qué campo
      // rechazó Conekta) viene en error.response.data.
      const errObj = orderError as {
        response?: { data?: unknown; status?: number };
        message?: string;
      };
      const detail = errObj.response?.data
        ? JSON.stringify(errObj.response.data)
        : errObj.message || String(orderError);
      console.error("Error creating Conekta order:", detail);
      return NextResponse.json(
        { error: `Error creating order: ${detail}` },
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

    // Registrar el intento como "pendiente" solo para efectivo: ahí sí existe
    // una referencia real y cobrable de inmediato aunque el cliente cierre la
    // pestaña. Para tarjeta, si nunca llega a pagar en la página de Conekta no
    // hay nada procesándose — el webhook de suscripción inserta el registro
    // cuando el cobro realmente se confirma.
    if (!isCardSubscription) {
      await supabase.from("payment_history").insert({
        subscription_id: subscription.id,
        amount: amount / 100,
        currency: "MXN",
        payment_method: type || "cash",
        status: "pending",
        conekta_order_id: (orderData.id as string) || null,
      });
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
