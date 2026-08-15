import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";

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

    return NextResponse.json({
      success: true,
      estado: pago.estado,
      venta_id: pago.venta_id,
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