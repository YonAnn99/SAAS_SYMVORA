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
      .select("id, conekta_customer_id, conekta_subscription_id, status")
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

    // Cancel in Conekta first — solo si existe una suscripción recurrente real
    // ahí (tarjeta con cobro automático). Clientes que solo pagaron en
    // efectivo, o que pagaron con el flujo antiguo de orden única, nunca
    // tuvieron una Subscription en Conekta y no hay nada que cancelar del
    // lado de Conekta; intentarlo con solo el customer_id fallaba con 404.
    if (subscription.conekta_subscription_id) {
      try {
        const { cancelSubscription } = await import("@/features/payments/services/conekta/subscriptions");
        await cancelSubscription(subscription.conekta_customer_id);
      } catch (conektaError: unknown) {
        const errObj = conektaError as {
          response?: {
            status?: number;
            data?: { details?: Array<{ code?: string; type?: string }>; type?: string };
          };
          message?: string;
        };
        // Conekta solo permite una suscripción activa por cliente
        // (/customers/{id}/subscription). Si ya no existe (por ejemplo, un
        // intento anterior sí canceló en Conekta pero la actualización local
        // no llegó a completarse), responde "no encontrado" — describiéndolo
        // como si fuera el Customer el que falta, aunque en realidad es la
        // suscripción anidada. Eso no es un fallo real: ya está cancelada
        // del lado de Conekta, así que seguimos y sincronizamos lo local.
        const details = errObj.response?.data?.details ?? [];
        const notFound =
          errObj.response?.status === 404 ||
          errObj.response?.data?.type === "resource_not_found_error" ||
          details.some((d) => d.type === "resource_not_found_error" || d.code?.includes("resource_not_found"));

        if (!notFound) {
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