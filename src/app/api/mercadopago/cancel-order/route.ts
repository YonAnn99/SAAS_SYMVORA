import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { cancelOrder, getOrder } from "@/features/payments/services/mercadopago/orders";
import { estadoTerminal } from "@/features/payments/services/mercadopago/webhook";
import {
  getMercadoPagoPointConfig,
  readMercadoPagoSecrets,
} from "@/features/payments/services/mercadopago/secrets";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 30;

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

    // Se intenta cancelar y, haya funcionado o no, se pregunta a Mercado Pago
    // como quedo la orden: esa es la verdad, no la respuesta del cancel.
    let orderStatus = "unknown";
    if (secrets.accessToken) {
      try {
        await cancelOrder(secrets.accessToken, body.mp_order_id);
      } catch (error) {
        // Tipico: la orden ya llego a la terminal y solo se cancela ahi.
        console.warn("Mercado Pago no cancelo la orden:", error);
      }
      try {
        const order = await getOrder(secrets.accessToken, body.mp_order_id);
        orderStatus = order.status ?? "unknown";
      } catch (error) {
        console.error("Error consultando orden Mercado Pago:", error);
      }
    }

    const estado = estadoTerminal(orderStatus);
    if (estado === "PAGADA") {
      return NextResponse.json({
        success: true,
        pagado: true,
        message: "El pago ya fue procesado",
      });
    }

    // Sigue viva en la terminal (o no se pudo saber): NO se marca cancelada.
    // Si se marcara y el cliente pagara despues, el punto de venta ya habria
    // soltado el carrito. El cajero la cancela en la terminal y el webhook
    // avisa.
    if (estado === null && secrets.accessToken) {
      return NextResponse.json(
        {
          error:
            "La terminal ya tiene el cobro. Cancélalo en la terminal; aquí se actualiza solo.",
          en_terminal: true,
        },
        { status: 409 }
      );
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
      .is("venta_id", null)
      // Sin `.select()` supabase-js devuelve `data = null`: "0 filas" parecia
      // "el webhook ya la pago" y CADA cancelacion se mostraba como venta hecha.
      .select("id");

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