import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { requireTenantAccess } from "@/lib/supabase/auth";
import crypto from "crypto";

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars[crypto.randomInt(chars.length)];
    }
    segments.push(segment);
  }
  return `SYM-${segments.join("-")}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { count = 1, expires_days = 30 } = body;

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { error: "Count must be between 1 and 100" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request);
    if (!auth.ok) return auth.response;

    const supabase = createSupabaseServiceRoleClient();

    const { data: superAdminMembership } = await supabase
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("role", "SUPER_ADMIN")
      .limit(1)
      .single();

    if (!superAdminMembership) {
      return NextResponse.json(
        { error: "Solo SUPER_ADMIN puede generar códigos" },
        { status: 403 }
      );
    }

    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      let code = generateCode();
      let attempts = 0;

      while (attempts < 10) {
        const { data: existing } = await supabase
          .from("trial_codes")
          .select("id")
          .eq("code", code)
          .single();

        if (!existing) break;
        code = generateCode();
        attempts++;
      }

      const { error } = await supabase.from("trial_codes").insert({
        code,
        expires_at: new Date(
          Date.now() + expires_days * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      if (!error) {
        codes.push(code);
      }
    }

    return NextResponse.json({ codes });
  } catch (error) {
    console.error("Error generating trial codes:", error);
    return NextResponse.json(
      { error: "Failed to generate codes" },
      { status: 500 }
    );
  }
}
