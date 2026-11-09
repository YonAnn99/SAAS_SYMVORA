import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { conciliarPagoTerminal } from "@/features/payments/services/mercadopago/conciliar";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 30;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const mpOrderId = searchParams.get("mp_order_id");

    if (!tenantId || !mpOrderId) {
      return NextResponse.json(
        { error: "tenant_id y mp_order_id son requeridos" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, { tenantId });
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServiceRoleClient();
    const { data: pago } = await supabase
      .from("pagos_terminal")
      .select("id, estado, venta_id, monto")
      .eq("mp_order_id", mpOrderId)
      .eq("tenant_id", tenantId)
      .single();

    if (!pago) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Mientras siga en curso, se le pregunta a Mercado Pago: sin esto el POS
    // dependia solo del webhook y, si no llegaba, esperaba para siempre aunque
    // ya se hubiera pagado o cancelado en la terminal.
    let estado: string = pago.estado;
    let ventaId: string | null = pago.venta_id;
    if (!pago.venta_id && (pago.estado === "CREADA" || pago.estado === "ESPERANDO_PAGO")) {
      try {
        const conciliado = await conciliarPagoTerminal(tenantId, mpOrderId);
        if (conciliado) {
          estado = conciliado.estado;
          ventaId = conciliado.venta_id;
        }
      } catch (error) {
        // No se pudo registrar el estado (p. ej. la venta fallo): se responde lo
        // de la base y el POS vuelve a preguntar en la siguiente vuelta.
        console.error("Error conciliando pago de terminal:", error);
      }
    }

    return NextResponse.json({
      success: true,
      estado,
      venta_id: ventaId,
      monto: pago.monto,
    });
  } catch (error) {
    console.error("Order status error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}