import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, key } = await request.json();

    if (!email || !key) {
      return NextResponse.json(
        { error: "Correo y clave son requeridos" },
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

    // Validate the invite key
    const { data: keyData, error: keyError } = await supabase
      .rpc("validate_invite_key", {
        p_email: email.toLowerCase(),
        p_key: key.toUpperCase(),
      });

    if (keyError) {
      console.error("Key validation error:", keyError);
      return NextResponse.json(
        { error: "Error al validar la clave" },
        { status: 500 }
      );
    }

    if (!keyData || keyData.length === 0 || !keyData[0].p_valid) {
      return NextResponse.json(
        { error: "Correo o clave incorrectos, o la clave ya fue utilizada" },
        { status: 401 }
      );
    }

    const { p_tenant_id: tenantId, p_role: role } = keyData[0];

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;
    let password: string;

    if (existingUser) {
      userId = existingUser.id;
      // Generate a new password for existing user (they may not have one if OAuth-only)
      password = `Symvora${Date.now()}!`;
      await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...existingUser.user_metadata,
          tenant_id: tenantId,
          role,
        },
      });
    } else {
      password = `Symvora${Date.now()}!`;
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          tenant_id: tenantId,
          role,
        },
      });

      if (createError || !newUser?.user) {
        console.error("Failed to create user:", createError);
        return NextResponse.json(
          { error: "Error al crear el usuario" },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
    }

    // Ensure tenant membership exists
    const { error: membershipError } = await supabase
      .from("tenant_memberships")
      .upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          role,
        },
        { onConflict: "user_id,tenant_id" }
      );

    if (membershipError) {
      console.error("Failed to create/update membership:", membershipError);
    }

    // Return email + password so the client can call signInWithPassword
    return NextResponse.json({
      success: true,
      email: email.toLowerCase(),
      password,
      tenantId,
      role,
    });
  } catch (error) {
    console.error("Key login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
