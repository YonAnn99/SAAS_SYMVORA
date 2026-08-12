import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
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

    let query = supabase
      .from("facturas")
      .select("*, clientes(nombre, rfc)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (estado) {
      query = query.eq("estado", estado);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error listing facturas:", error);
      return NextResponse.json(
        { error: "Error al listar facturas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      facturas: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("List facturas error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
