import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { assertFacturasEnabled } from "@/lib/feature-flags";
import {
  FacturacionError,
  getFiscalConfig,
  saveFiscalConfig,
  type SaveFiscalConfigInput,
} from "@/features/facturacion/services/factura-service";

export async function GET(request: NextRequest) {
  const facturas = assertFacturasEnabled();
  if (!facturas.ok) return facturas.response;

  try {
    const auth = await requireTenantAccess(request);
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServiceRoleClient();

    const data = await getFiscalConfig(supabase, auth.userId);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Get facturas config error:", error);
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

export async function POST(request: NextRequest) {
  const facturas = assertFacturasEnabled();
  if (!facturas.ok) return facturas.response;

  try {
    const body: SaveFiscalConfigInput = await request.json();

    if (!body.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id requerido" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    const auth = await requireTenantAccess(request, {
      tenantId: body.tenant_id,
      permission: "billing.config",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const result = await saveFiscalConfig(supabase, body);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Save facturas config error:", error);
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