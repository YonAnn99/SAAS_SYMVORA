import createMiddleware from "next-intl/middleware";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";
import { type NextRequest } from "next/server";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // First: update Supabase session
  const supabaseResponse = await updateSession(request);

  // Check if Supabase middleware already redirected (e.g., to login)
  if (supabaseResponse.status === 307 || supabaseResponse.status === 308) {
    return supabaseResponse;
  }

  // Second: handle i18n routing
  const i18nResponse = await handleI18nRouting(request);

  // Resolve the final response, copying Supabase cookies to the i18n response
  let response = supabaseResponse;
  if (i18nResponse && (i18nResponse.status === 307 || i18nResponse.status === 308)) {
    response = i18nResponse;
  } else if (i18nResponse) {
    const supabaseCookies = supabaseResponse.headers.getSetCookie();
    if (supabaseCookies.length > 0) {
      supabaseCookies.forEach((cookie) => {
        i18nResponse.headers.append("Set-Cookie", cookie);
      });
    }
    response = i18nResponse;
  }

  // Noindex for any host that is not the marketing site (app subdomain,
  // previews *.vercel.app, old vercel.app domain, localhost).
  const host = request.headers.get("host") ?? "";
  if (host !== "www.symvora.com.mx" && host !== "symvora.com.mx") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
