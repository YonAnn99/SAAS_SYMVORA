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

  if (options.permission) {
    const { data: hasPermission } = await serviceClient
      .from("role_permissions")
      .select("permission")
      .eq("role", role)
      .eq("permission", options.permission)
      .single();

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
