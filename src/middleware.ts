import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";
import { type NextRequest } from "next/server";

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // First: update Supabase session
  const supabaseResponse = await updateSession(request);

  // Second: handle i18n routing
  const i18nResponse = await handleI18nRouting(request);

  // Merge cookies from both responses
  if (i18nResponse) {
    supabaseResponse.headers.set(
      "x-middleware-rewrite",
      i18nResponse.headers.get("x-middleware-rewrite") || ""
    );

    // Copy Set-Cookie headers from i18n response
    const i18nCookies = i18nResponse.headers.getSetCookie();
    if (i18nCookies.length > 0) {
      i18nCookies.forEach((cookie) => {
        supabaseResponse.headers.append("Set-Cookie", cookie);
      });
    }

    // If i18n redirects, use that redirect
    if (i18nResponse.status === 307 || i18nResponse.status === 308) {
      return i18nResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Enable a pathless prefix for i18n
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
