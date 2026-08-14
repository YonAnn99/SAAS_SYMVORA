import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { cancelOrder, getOrder } from "@/lib/mercadopago/orders";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
} from "@/lib/mercadopago/secrets";

export const dynamic = "force-dynamic";

interface CancelOrderRequest {
  tenant_id: string;
  mp_order_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CancelOrderRequest;

    if (!body.tenant_id || !body.mp_order_id) {
      return NextResponse.json(
        { error: "tenant_id y mp_order_id son requeridos" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "sales.create",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const supabase = createSupabaseServiceRoleClient();

    const { data: pago } = await supabase
      .from("pagos_terminal")
      .select("id, estado, venta_id")
      .eq("mp_order_id", body.mp_order_id)
      .eq("tenant_id", body.tenant_id)
      .single();

    if (!pago) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    if (pago.venta_id) {
      return NextResponse.json({
        success: true,
        pagado: true,
        message: "El pago ya fue procesado",
      });
    }

    const config = await getMercadoPagoPointConfig(body.tenant_id);
    const secrets = await readMercadoPagoSecrets(body.tenant_id, config);

    let orderStatus = "unknown";
    if (secrets.accessToken) {
      try {
        await cancelOrder(secrets.accessToken, body.mp_order_id);
        const order = await getOrder(secrets.accessToken, body.mp_order_id);
        orderStatus = order.status ?? "unknown";
      } catch (error) {
        console.error("Error cancelando orden Mercado Pago:", error);
      }
    }

    if (orderStatus === "processed" || orderStatus === "refunded") {
      return NextResponse.json({
        success: true,
        pagado: true,
        message: "El pago ya fue procesado",
      });
    }

    // Update condicional: solo marca CANCELADA si el webhook NO confirmó
    // el pago mientras tanto (venta_id sigue NULL). Esto evita la race
    // donde el pago llega justo después de la comprobación inicial.
    const { data: updatedRows, error: updateError } = await supabase
      .from("pagos_terminal")
      .update({
        estado: "CANCELADA",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", pago.id)
      .is("venta_id", null);

    if (updateError) {
      console.error("Error cancelando pago_terminal:", updateError);
      return NextResponse.json(
        { error: "No se pudo cancelar el cobro" },
        { status: 500 }
      );
    }

    const updated = (updatedRows ?? []) as unknown[];
    if (updated.length === 0) {
      return NextResponse.json({
        success: true,
        pagado: true,
        message: "El pago ya fue procesado",
      });
    }

    return NextResponse.json({ success: true, pagado: false });
  } catch (error) {
    console.error("Cancel order error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}