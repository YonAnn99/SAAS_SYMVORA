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

function resolveDefaultLocale(request: Request): string {
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const primary = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("en")) return "en";
  return "es";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const defaultNext = `/${resolveDefaultLocale(request)}/dashboard`;
  const next = searchParams.get("next") ?? defaultNext;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = isSafeRedirectPath(next) ? next : defaultNext;
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const locale = resolveDefaultLocale(request);
  return NextResponse.redirect(`${origin}/${locale}/auth?error=auth`);
}
