import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id is required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, { tenantId: tenant_id });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const userClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "No user email" }, { status: 401 });
    }

    const supabase = createSupabaseServiceRoleClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nombre_comercial, codigo_referido")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { sendWelcomeEmail } = await import("@/lib/email");
    const result = await sendWelcomeEmail({
      to: user.email,
      businessName: tenant.nombre_comercial || "tu negocio",
      referralCode: tenant.codigo_referido,
      type: "signup",
    });

    if (!result.ok) {
      // El email es best-effort: no debe romper el signup del cliente.
      console.error("[email/welcome] send failed:", result.error);
      return NextResponse.json({ ok: false, error: result.error });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email/welcome] Unexpected error:", msg);
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 }
    );
  }
}
