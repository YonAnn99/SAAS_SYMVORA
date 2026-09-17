import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { sendPasswordChangedAlertEmail } from "@/lib/email";

export const maxDuration = 30;

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
    if (!demo.ok) {
      // En modo demo, no enviamos emails pero devolvemos ok para no romper la UI
      return NextResponse.json({ ok: true, demo: true });
    }

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
      .select("nombre_comercial")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const businessName = tenant.nombre_comercial || "tu negocio";

    // 1. Notificar al usuario afectado que su contraseña cambió
    await sendPasswordChangedAlertEmail({
      to: user.email,
      businessName,
      userEmail: user.email,
      userRole: auth.role || undefined,
      isSelf: true,
    });

    // 2. Si el usuario que cambió contraseña no es SUPER_ADMIN, notificar también al SUPER_ADMIN
    if (auth.role !== "SUPER_ADMIN") {
      const { data: owner } = await supabase
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("role", "SUPER_ADMIN")
        .limit(1)
        .maybeSingle();

      if (owner?.user_id) {
        const { data: ownerUser } = await supabase.auth.admin.getUserById(owner.user_id);
        const ownerEmail = ownerUser?.user?.email;
        if (ownerEmail && ownerEmail !== user.email) {
          await sendPasswordChangedAlertEmail({
            to: ownerEmail,
            businessName,
            userEmail: user.email,
            userRole: auth.role || "Colaborador",
            isSelf: false,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[email/password-changed] Unexpected error:", msg);
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 }
    );
  }
}
