import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isSafeRedirectPath(value: string | null): value is string {
  if (!value) {
    return false;
  }

  if (value.startsWith("//") || value.startsWith("\\\\")) {
    return false;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return false;
  }

  return value.startsWith("/");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/es/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = isSafeRedirectPath(next) ? next : "/es/dashboard";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/es/login?error=auth`);
}
