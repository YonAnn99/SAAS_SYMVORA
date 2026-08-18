import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import {
  FacturacionError,
  getFacturaXml,
} from "@/features/facturacion/services/factura-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createSupabaseServiceRoleClient();

    const { data: factura, error: facturaError } = await supabase
      .from("facturas")
      .select("tenant_id")
      .eq("id", id)
      .single();

    if (facturaError || !factura) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: factura.tenant_id,
      permission: "billing.view",
    });
    if (!auth.ok) return auth.response;

    const result = await getFacturaXml(supabase, id);

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="factura-${result.factura.serie}-${result.factura.folio}.xml"`,
      },
    });
  } catch (error) {
    console.error("Download factura XML error:", error);
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