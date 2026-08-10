import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";
import { type NextRequest } from "next/server";

const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // First: update Supabase session
  const supabaseResponse = await updateSession(request);

  // Check if Supabase middleware already redirected (e.g., to login)
  if (supabaseResponse.status === 307 || supabaseResponse.status === 308) {
    return supabaseResponse;
  }

  // Second: handle i18n routing
  const i18nResponse = await handleI18nRouting(request);

  // If i18n middleware redirects, use that response
  if (i18nResponse && (i18nResponse.status === 307 || i18nResponse.status === 308)) {
    return i18nResponse;
  }

  // Copy Supabase cookies to the i18n response
  if (i18nResponse) {
    const supabaseCookies = supabaseResponse.headers.getSetCookie();
    if (supabaseCookies.length > 0) {
      supabaseCookies.forEach((cookie) => {
        i18nResponse.headers.append("Set-Cookie", cookie);
      });
    }
    return i18nResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
