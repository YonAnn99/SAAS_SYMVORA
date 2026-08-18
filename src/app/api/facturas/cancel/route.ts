import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import {
  cancelFactura,
  FacturacionError,
  type CancelFacturaInput,
} from "@/features/facturacion/services/factura-service";

export async function POST(request: NextRequest) {
  try {
    const body: CancelFacturaInput = await request.json();
    const supabase = createSupabaseServiceRoleClient();

    const { data: factura, error: facturaError } = await supabase
      .from("facturas")
      .select("tenant_id")
      .eq("id", body.factura_id)
      .single();

    if (facturaError || !factura) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: factura.tenant_id,
      permission: "billing.cancel",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const result = await cancelFactura(supabase, body);

    return NextResponse.json({
      success: true,
      accepted: result.accepted,
      message: result.message,
    });
  } catch (error) {
    console.error("Cancel factura error:", error);
    if (error instanceof FacturacionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}