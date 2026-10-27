import { after, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { consumirRateLimit } from "@/lib/rate-limit";
import { nombreCompleto } from "@/lib/nombre-usuario";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
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
      .select("nombre_comercial, codigo_referido, giro_comercial, creado_en")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Aviso interno a hola@ de que hay un negocio nuevo. Despues de responder
    // (`after`): nunca demora ni rompe el alta del cliente. Una vez por negocio
    // aunque la ruta se vuelva a llamar.
    after(async () => {
      try {
        const limite = await consumirRateLimit(`aviso-alta:${tenant_id}`, 1, 30 * 24 * 60 * 60);
        if (!limite.permitido) return;
        const { data: contacto } = await supabase
          .from("contacto_usuarios")
          .select("telefono")
          .eq("user_id", user.id)
          .maybeSingle();
        const { construirCorreoNuevoNegocio } = await import("@/lib/resumen-interno");
        const { sendCorreoInterno } = await import("@/lib/email");
        const envio = await sendCorreoInterno(
          construirCorreoNuevoNegocio({
            negocio: tenant.nombre_comercial || "Sin nombre",
            giro: tenant.giro_comercial ?? null,
            dueno: nombreCompleto(user.user_metadata) || null,
            correo: user.email ?? null,
            celular: contacto?.telefono ?? null,
            origen: (user.app_metadata?.provider as string | undefined) ?? null,
            creado_en: tenant.creado_en ?? new Date().toISOString(),
          })
        );
        if (!envio.ok) console.error("[email/welcome] aviso interno no enviado:", envio.error);
      } catch (err) {
        console.error("[email/welcome] aviso interno falló:", err);
      }
    });

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
