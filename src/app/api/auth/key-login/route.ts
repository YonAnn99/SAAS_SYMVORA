import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, key } = await request.json();
    console.log("[key-login] Received:", { email, key: key?.substring(0, 3) + "..." });

    if (!email || !key) {
      return NextResponse.json(
        { error: "Correo y clave son requeridos" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[key-login] Missing env vars");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Validate the invite key
    console.log("[key-login] Validating key for email:", email.toLowerCase());
    const { data: keyData, error: keyError } = await supabase
      .rpc("validate_invite_key", {
        p_email: email.toLowerCase(),
        p_key: key.toUpperCase(),
      });

    if (keyError) {
      console.error("[key-login] RPC error:", keyError);
      return NextResponse.json(
        { error: "Error al validar la clave" },
        { status: 500 }
      );
    }

    console.log("[key-login] RPC result:", JSON.stringify(keyData));

    if (!keyData || keyData.length === 0 || !keyData[0].p_valid) {
      console.log("[key-login] Key invalid or already used");
      return NextResponse.json(
        { error: "Correo o clave incorrectos, o la clave ya fue utilizada" },
        { status: 401 }
      );
    }

    const { p_tenant_id: tenantId, p_role: role } = keyData[0];
    console.log("[key-login] Key valid. tenant:", tenantId, "role:", role);

    // Step 2: Find or create user in Supabase Auth
    let userId: string;
    let password: string;

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("[key-login] listUsers error:", listError);
    }
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    console.log("[key-login] Existing user found:", existingUser?.id || "none");

    if (existingUser) {
      // User exists - update password and metadata
      userId = existingUser.id;
      password = `Symvora${Date.now()}!`;

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...existingUser.user_metadata,
          tenant_id: tenantId,
          role,
        },
      });

      if (updateError) {
        console.error("[key-login] Failed to update user:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar el usuario" },
          { status: 500 }
        );
      }
      console.log("[key-login] Updated existing user:", userId);
    } else {
      // Create new user
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
        console.error("[key-login] Failed to create user:", createError);
        return NextResponse.json(
          { error: "Error al crear el usuario" },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
      console.log("[key-login] Created new user:", userId);
    }

    // Step 3: Ensure tenant membership exists
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
      console.error("[key-login] Membership upsert error:", membershipError);
    } else {
      console.log("[key-login] Membership ensured for user:", userId, "tenant:", tenantId);
    }

    // Step 4: Return credentials for client to sign in
    console.log("[key-login] Success. Returning credentials.");
    return NextResponse.json({
      success: true,
      email: email.toLowerCase(),
      password,
      tenantId,
      role,
    });
  } catch (error) {
    console.error("[key-login] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
