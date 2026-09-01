import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_HOURS = 1;

const VALID_CATEGORIAS = ["general", "bug", "mejora", "feature"];
const VALID_PRIORIDADES = ["baja", "media", "alta"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenant_id, categoria, prioridad, titulo, descripcion } = body;

    if (!tenant_id || !categoria || !prioridad || !titulo || !descripcion) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIAS.includes(categoria)) {
      return NextResponse.json(
        { error: "Categoría inválida" },
        { status: 400 }
      );
    }

    if (!VALID_PRIORIDADES.includes(prioridad)) {
      return NextResponse.json(
        { error: "Prioridad inválida" },
        { status: 400 }
      );
    }

    if (typeof titulo !== "string" || titulo.trim().length < 3 || titulo.length > 120) {
      return NextResponse.json(
        { error: "El título debe tener entre 3 y 120 caracteres" },
        { status: 400 }
      );
    }

    if (typeof descripcion !== "string" || descripcion.trim().length < 10 || descripcion.length > 2000) {
      return NextResponse.json(
        { error: "La descripción debe tener entre 10 y 2000 caracteres" },
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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = createSupabaseServiceRoleClient();

    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { count: recentCount } = await supabase
      .from("sugerencias")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .gte("creado_en", windowStart);

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Límite de sugerencias alcanzado. Intenta más tarde." },
        { status: 429 }
      );
    }

    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant:tenants(nombre_comercial)")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    const tenantName =
      (membership?.tenant as { nombre_comercial?: string } | null)
        ?.nombre_comercial || "Sin nombre";

    const { error: insertError } = await supabase.from("sugerencias").insert({
      tenant_id,
      usuario_id: user.id,
      categoria,
      prioridad,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
    });

    if (insertError) {
      console.error("[suggestions] insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Error al guardar la sugerencia" },
        { status: 500 }
      );
    }

    const { sendSuggestionEmail } = await import("@/lib/email");
    const result = await sendSuggestionEmail({
      tenantName,
      userEmail: user.email,
      categoria,
      prioridad,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
    });

    if (!result.ok) {
      console.error("[suggestions] send failed:", result.error);
      return NextResponse.json(
        { error: "Error al enviar la sugerencia" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[suggestions] Unexpected error:", msg);
    return NextResponse.json(
      { error: `Error inesperado: ${msg}` },
      { status: 500 }
    );
  }
}
