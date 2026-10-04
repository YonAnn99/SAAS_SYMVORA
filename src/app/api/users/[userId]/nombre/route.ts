import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 15;

const MAX_NOMBRE = 120;

/**
 * El dueño captura o corrige el nombre de alguien de su equipo desde Usuarios.
 * Sirve sobre todo para las cuentas creadas antes de que la invitacion pidiera
 * nombre (migracion 101).
 *
 * Se guarda igual que en Mi perfil: `nombre` (lo leen correos, Conekta y el
 * historial) y `nombre_completo`/`full_name` con el mismo valor, para que
 * `nombreCompleto()` no prefiera un valor viejo.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { tenantId, nombre: nombreCrudo } = await request.json();
    const nombre = typeof nombreCrudo === "string" ? nombreCrudo.trim() : "";

    if (!tenantId || typeof tenantId !== "string") {
      return NextResponse.json({ error: "tenantId es requerido" }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }
    if (nombre.length > MAX_NOMBRE) {
      return NextResponse.json(
        { error: `El nombre admite hasta ${MAX_NOMBRE} caracteres` },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "org.manage_members_write",
    });
    if (!auth.ok) return auth.response;

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Con `service_role` no hay RLS: sin esta comprobacion, el dueño de un
    // negocio podria renombrar a cualquier usuario del sistema.
    const { data: membresia } = await supabase
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!membresia) {
      return NextResponse.json(
        { error: "Ese usuario no pertenece a tu negocio" },
        { status: 404 }
      );
    }

    // Se mezcla con el metadata existente: reemplazarlo borraria `role` y
    // `tenant_id` (ver el PATCH de rol en `../route.ts`).
    const { data: objetivo } = await supabase.auth.admin.getUserById(userId);
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(objetivo?.user?.user_metadata ?? {}),
        nombre,
        nombre_completo: nombre,
        full_name: nombre,
      },
    });

    if (error) {
      console.error("Failed to update user name:", error);
      return NextResponse.json({ error: "Error al actualizar el nombre" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH user name error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
