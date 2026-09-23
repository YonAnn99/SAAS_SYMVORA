import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server.server";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 15;

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

/** Idioma desde el que se pulso "Continuar con Google" (lo fija `handleOAuth`). */
const LOCALE_OAUTH_COOKIE = "oauth_locale";

function resolveDefaultLocale(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const elegido = cookie.match(/(?:^|;\s*)oauth_locale=(es|en)(?:;|$)/)?.[1];
  if (elegido) return elegido;

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
      // Si aun no tiene negocio (primera vez con Google), el middleware lo
      // manda a /completar-registro desde el dashboard.
      const respuesta = NextResponse.redirect(`${origin}${safeNext}`);
      respuesta.cookies.delete(LOCALE_OAUTH_COOKIE);
      return respuesta;
    }
  }

  const locale = resolveDefaultLocale(request);
  return NextResponse.redirect(`${origin}/${locale}/auth?error=auth`);
}
