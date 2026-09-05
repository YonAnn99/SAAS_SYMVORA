import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertFacturasEnabled } from "@/lib/feature-flags";
import {
  FacturacionError,
  listFacturas,
} from "@/features/facturacion/services/factura-service";

export async function GET(request: NextRequest) {
  const facturas = assertFacturasEnabled();
  if (!facturas.ok) return facturas.response;

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const estado = searchParams.get("estado");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "billing.view",
    });
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServiceRoleClient();

    const data = await listFacturas(supabase, { tenant_id: tenantId, estado: estado ?? undefined, page, limit });

    return NextResponse.json({
      facturas: data.facturas,
      total: data.total,
      page,
      limit,
      totalPages: data.totalPages,
    });
  } catch (error) {
    console.error("List facturas error:", error);
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