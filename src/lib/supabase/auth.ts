import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server.server";
import type { UserRole } from "@/lib/types/database";
import { DEMO_USER_EMAIL } from "@/lib/supabase/demo-guard";

interface TenantAccessOptions {
  tenantId?: string;
  permission?: string;
  selfUserId?: string;
}

export type TenantAccessResult =
  | {
      ok: true;
      userId: string;
      role?: UserRole;
      isDemo: boolean;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireTenantAccess(
  request: Request,
  options: TenantAccessOptions = {}
): Promise<TenantAccessResult> {
  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const isDemo =
    user.email === DEMO_USER_EMAIL ||
    (user.app_metadata as Record<string, unknown> | null)?.is_demo === true;

  if (options.selfUserId && options.selfUserId !== user.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No autorizado para esta acción" },
        { status: 403 }
      ),
    };
  }

  if (!options.tenantId) {
    return { ok: true, userId: user.id, isDemo };
  }

  const serviceClient = createSupabaseServiceRoleClient();

  const { data: membership } = await serviceClient
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", options.tenantId)
    .single();

  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No tienes acceso a este tenant" },
        { status: 403 }
      ),
    };
  }

  const role = membership.role as UserRole;

  // Permiso EFECTIVO, no solo el del rol: las excepciones por usuario
  // (`user_permission_overrides`) ganan en ambos sentidos, igual que en
  // `authorize()`. Mirar solo `role_permissions` dejaba sin la funcion a quien
  // el dueño se la concedio y se la dejaba a quien se la quito.
  if (options.permission) {
    const hasPermission = await tienePermisoEfectivo(
      user.id,
      role,
      options.permission,
      options.tenantId
    );

    if (!hasPermission) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "No tienes permisos para esta acción" },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, userId: user.id, role, isDemo };
}

/**
 * Si el usuario tiene un permiso, con la MISMA regla que `authorize()` en la
 * base: primero su excepcion por usuario (gana en ambos sentidos) y, si no
 * tiene, lo que da su rol. Para rutas que corren con la service role y no
 * pueden llamar a `authorize()` (que lee el JWT de la sesion).
 *
 * Con `tenantId` la excepcion se busca solo en ese negocio. `authorize()` no
 * puede acotarla (no recibe el tenant); hoy da igual porque cada usuario tiene
 * un solo negocio (migracion 087), pero aqui si se sabe y es lo exacto.
 */
export async function tienePermisoEfectivo(
  userId: string,
  role: UserRole | undefined,
  permission: string,
  tenantId?: string
): Promise<boolean> {
  const serviceClient = createSupabaseServiceRoleClient();

  let consultaExcepcion = serviceClient
    .from("user_permission_overrides")
    .select("granted")
    .eq("user_id", userId)
    .eq("permission", permission);
  if (tenantId) consultaExcepcion = consultaExcepcion.eq("tenant_id", tenantId);

  const { data: excepcion } = await consultaExcepcion.maybeSingle();
  if (excepcion) return Boolean(excepcion.granted);

  if (!role) return false;
  const { data: porRol } = await serviceClient
    .from("role_permissions")
    .select("permission")
    .eq("role", role)
    .eq("permission", permission)
    .maybeSingle();
  return Boolean(porRol);
}
