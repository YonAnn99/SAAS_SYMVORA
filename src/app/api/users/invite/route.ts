import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/supabase/auth";
import type { UserRole } from "@/lib/types/database";

const INVITABLE_ROLES: UserRole[] = ["ORG_ADMIN", "CAJERO"];

export async function POST(request: Request) {
  try {
    const { email, role, tenantId } = await request.json();

    if (!email || !role || !tenantId) {
      return NextResponse.json(
        { error: "Email, role, and tenantId are required" },
        { status: 400 }
      );
    }

    const requestedRole: UserRole = role as UserRole;
    if (!INVITABLE_ROLES.includes(requestedRole) && requestedRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Role inválido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "org.manage_members",
    });
    if (!auth.ok) return auth.response;

    if (requestedRole === "SUPER_ADMIN" && auth.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Solo un SUPER_ADMIN puede invitar a otro SUPER_ADMIN" },
        { status: 403 }
      );
    }

    const roleToAssign: UserRole = requestedRole;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Invite user via Supabase Auth
    const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          tenant_id: tenantId,
          role: roleToAssign,
        },
        redirectTo: `${supabaseUrl}/auth/v1/verify?redirect_to=${encodeURIComponent(`${supabaseUrl}/es/dashboard`)}`,
      }
    );

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      );
    }

    // Create membership record
    if (data?.user) {
      const { error: membershipError } = await supabase
        .from("tenant_memberships")
        .insert({
          user_id: data.user.id,
          tenant_id: tenantId,
          role: roleToAssign,
        });

      if (membershipError) {
        console.error("Failed to create membership:", membershipError);
        // User was invited but membership failed - they can be added manually
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
