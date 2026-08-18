import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import {
  createFactura,
  FacturacionError,
  type CreateFacturaInput,
} from "@/features/facturacion/services/factura-service";

export async function POST(request: NextRequest) {
  try {
    const body: CreateFacturaInput = await request.json();

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "billing.create",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const factura = await createFactura(supabase, body);

    return NextResponse.json({
      success: true,
      factura,
    });
  } catch (error) {
    console.error("Create factura error:", error);
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
