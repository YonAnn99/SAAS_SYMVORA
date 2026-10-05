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
    // 1. Todo, MENOS las precargas de `next/link`. Cada enlace visible del menu
    //    se precarga, y cada precarga corria el middleware completo (`getUser` +
    //    RPC): decenas de verificaciones por carga del panel. Es seguro
    //    saltarlas porque el layout del panel es `force-dynamic`: la precarga
    //    solo trae el esqueleto (`loading.tsx`, sin datos) y la NAVEGACION REAL
    //    es otra peticion que si pasa por aqui con todos los controles (sesion,
    //    suscripcion, permisos por ruta). Si algun dia una ruta del panel se
    //    vuelve estatica, revisar esto: su precarga traeria la pagina completa.
    {
      source: "/((?!api|_next|_vercel|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // 2. Rutas SIN idioma, siempre (tambien en precarga): next-intl las redirige
    //    a `/es/...`; sin esto, la precarga de un enlace sin idioma daria 404.
    "/((?!api|_next|_vercel|es/|en/|es$|en$|.*\\..*).*)",
  ],
};
