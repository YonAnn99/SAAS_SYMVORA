import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/supabase/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { role, tenantId } = await request.json();

    if (!role || !tenantId) {
      return NextResponse.json(
        { error: "role and tenantId are required" },
        { status: 400 }
      );
    }

    if (!["ORG_ADMIN", "CAJERO"].includes(role)) {
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

    // Cannot change your own role
    if (auth.userId === userId) {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio rol" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Update role in tenant_memberships
    const { error: updateError } = await supabase
      .from("tenant_memberships")
      .update({ role })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("Failed to update role:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar el rol" },
        { status: 500 }
      );
    }

    // Update user metadata with new role
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "org.manage_members",
    });
    if (!auth.ok) return auth.response;

    // Cannot remove yourself
    if (auth.userId === userId) {
      return NextResponse.json(
        { error: "No puedes eliminarte a ti mismo" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Remove membership
    const { error: deleteError } = await supabase
      .from("tenant_memberships")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (deleteError) {
      console.error("Failed to remove member:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el miembro" },
        { status: 500 }
      );
    }

    // Delete the user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Failed to delete auth user:", authError);
      // Membership was removed, log but don't fail
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
