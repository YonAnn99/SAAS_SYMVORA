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
    const { tenant_id, codigo } = body;

    if (!tenant_id || typeof codigo !== "string" || !codigo.trim()) {
      return NextResponse.json(
        { error: "tenant_id and codigo are required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, { tenantId: tenant_id });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    // El RPC es SECURITY DEFINER y valida auth.uid() + membresía internamente,
    // por lo que debe ejecutarse con el cliente autenticado del usuario.
    const userClient = await createSupabaseServerClient();

    const { data, error } = await userClient.rpc("aplicar_codigo_promo", {
      p_codigo: codigo,
      p_tenant_id: tenant_id,
    });

    if (error) {
      console.error("[promo-apply] RPC error:", error.message);
      return NextResponse.json(
        { error: "Error aplicando el código" },
        { status: 500 }
      );
    }

    const result = data as { ok: boolean; razon?: string; trial_days?: number };

    if (!result?.ok) {
      return NextResponse.json(
        { error: result?.razon || "codigo_invalido", ok: false },
        { status: 400 }
      );
    }

    // Devuelve la suscripción actualizada para refrescar la UI
    const supabase = createSupabaseServiceRoleClient();
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, trial_start, trial_end")
      .eq("tenant_id", tenant_id)
      .single();

    return NextResponse.json({
      ok: true,
      trial_days: result.trial_days,
      subscription,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[promo-apply] Unexpected error:", msg);
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 }
    );
  }
}
