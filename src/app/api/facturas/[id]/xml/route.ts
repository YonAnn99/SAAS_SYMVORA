import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { generateCFDIXML } from "@/lib/cfdi/xml-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createSupabaseServiceRoleClient();

    const { data: factura, error: facturaError } = await supabase
      .from("facturas")
      .select("*")
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

    const { data: detalle, error: detalleError } = await supabase
      .from("factura_detalle")
      .select("*")
      .eq("factura_id", id)
      .order("orden");

    if (detalleError || !detalle) {
      return NextResponse.json(
        { error: "No se encontraron los conceptos de la factura" },
        { status: 404 }
      );
    }

    const xml = generateCFDIXML(factura, detalle);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="factura-${factura.serie}-${factura.folio}.xml"`,
      },
    });
  } catch (error) {
    console.error("Download factura XML error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}