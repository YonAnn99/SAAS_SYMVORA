import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { GRANTABLE_PERMISSIONS } from "@/lib/modules";

/**
 * Guarda las excepciones de permisos de un usuario concreto.
 *
 * Las guardas viven aquí, en el servidor, no en el diálogo: en este proyecto
 * la barrera cosmética ya falló cuatro veces (bugs #1, #27, #33, #34). Y por
 * si esto también fallara, la migración 055 pone un CHECK en la tabla que
 * rechaza los permisos que reparten poder pase lo que pase.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { tenantId, overrides } = await request.json();

    if (!tenantId || !Array.isArray(overrides)) {
      return NextResponse.json(
        { error: "tenantId y overrides son requeridos" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "org.manage_members_write",
    });
    if (!auth.ok) return auth.response;

    // Guarda 1: nadie se edita a sí mismo. Evita el autobloqueo y que alguien
    // se conceda accesos aunque tenga el permiso para repartirlos.
    if (auth.userId === userId) {
      return NextResponse.json(
        { error: "No puedes cambiar tus propios permisos" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Guarda 2: no se toca a otro SUPER_ADMIN. Un dueño no recorta a otro.
    const { data: target } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json(
        { error: "Ese usuario no pertenece a este negocio" },
        { status: 404 }
      );
    }

    if (target.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No puedes cambiar los permisos de otro administrador principal" },
        { status: 400 }
      );
    }

    // Guarda 3: solo permisos concedibles. Quedan fuera los que reparten poder
    // (usuarios, suscripción, borrar el negocio): concederlos convertiría a esa
    // persona en otro dueño sin que el rol lo diga.
    for (const o of overrides) {
      if (typeof o?.permission !== "string" || typeof o?.granted !== "boolean") {
        return NextResponse.json(
          { error: "Formato inválido: se espera { permission, granted }" },
          { status: 400 }
        );
      }
      if (!GRANTABLE_PERMISSIONS.has(o.permission)) {
        return NextResponse.json(
          { error: `El permiso "${o.permission}" no se puede conceder ni quitar` },
          { status: 403 }
        );
      }
    }

    // Se reemplaza el conjunto completo del usuario en vez de aplicar deltas:
    // así el estado guardado es siempre exactamente lo que muestra el diálogo,
    // sin filas huérfanas de ediciones anteriores.
    const { error: deleteError } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("[permissions] error al limpiar:", deleteError);
      return NextResponse.json(
        { error: "Error al guardar los permisos" },
        { status: 500 }
      );
    }

    // Deduplicación defensiva: si dos módulos llegaran a compartir permiso, el
    // INSERT chocaría con UNIQUE (tenant_id, user_id, permission) y devolvería
    // un 500. Pasó de verdad con Compras y Órdenes de compra. La causa se
    // corrigió en modules.ts (un módulo, varias rutas) y hay un test que la
    // vigila, pero la API no debe romperse por ello.
    const unicos = [
      ...new Map(
        (overrides as { permission: string; granted: boolean }[]).map((o) => [
          o.permission,
          o,
        ])
      ).values(),
    ];

    if (unicos.length > 0) {
      const { error: insertError } = await supabase
        .from("user_permission_overrides")
        .insert(
          unicos.map((o: { permission: string; granted: boolean }) => ({
            tenant_id: tenantId,
            user_id: userId,
            permission: o.permission,
            granted: o.granted,
            created_by: auth.userId,
          }))
        );

      if (insertError) {
        console.error("[permissions] error al insertar:", insertError);
        return NextResponse.json(
          { error: "Error al guardar los permisos" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, count: unicos.length });
  } catch (error) {
    console.error("PUT permissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
