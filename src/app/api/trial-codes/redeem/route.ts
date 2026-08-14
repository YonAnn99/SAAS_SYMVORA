import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, user_id, tenant_id } = body;

    if (!code || !user_id || !tenant_id) {
      return NextResponse.json(
        { error: "Code, user_id, and tenant_id are required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId: tenant_id,
      selfUserId: user_id,
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase.rpc("redeem_trial_code", {
      p_code: code,
      p_user_id: user_id,
      p_tenant_id: tenant_id,
    });

    if (error) {
      console.error("Error redeeming trial code:", error);
      return NextResponse.json(
        { error: "Failed to redeem code" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error redeeming trial code:", error);
    return NextResponse.json(
      { error: "Failed to redeem code" },
      { status: 500 }
    );
  }
}
