import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id } = body;

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

    const supabase = createSupabaseServiceRoleClient();

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

    if (subscription.status === "canceled") {
      return NextResponse.json(
        { error: "La suscripción ya está cancelada" },
        { status: 400 }
      );
    }

    // Cancel in Conekta first (only if a customer exists there)
    if (subscription.conekta_customer_id) {
      try {
        const { cancelSubscription } = await import("@/features/payments/services/conekta/subscriptions");
        await cancelSubscription(subscription.conekta_customer_id);
      } catch (conektaError: unknown) {
        const errObj = conektaError as {
          response?: { data?: unknown };
          message?: string;
        };
        const detail = errObj.response?.data
          ? JSON.stringify(errObj.response.data)
          : errObj.message || String(conektaError);
        console.error("Error canceling Conekta subscription:", detail);
        return NextResponse.json(
          { error: `Error al cancelar en Conekta: ${detail}` },
          { status: 500 }
        );
      }
    }

    // Update local records
    const now = new Date().toISOString();
    const [subResult, tenantResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: now })
        .eq("id", subscription.id),
      supabase
        .from("tenants")
        .update({ subscription_status: "canceled" })
        .eq("id", tenant_id),
    ]);

    if (subResult.error || tenantResult.error) {
      console.error(
        "Error updating local records:",
        subResult.error || tenantResult.error
      );
      return NextResponse.json(
        { error: "Error al actualizar el estado local" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Suscripción cancelada correctamente",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Unexpected error canceling subscription:", msg);
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 }
    );
  }
}