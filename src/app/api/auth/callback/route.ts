import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server.server";
import { COOKIE_DESTINO_OAUTH, rutaDeRegresoSegura } from "@/lib/ruta-de-regreso";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 15;

/** Idioma desde el que se pulso "Continuar con Google" (lo fija `handleOAuth`). */
const LOCALE_OAUTH_COOKIE = "oauth_locale";

/** Pagina a la que volver tras entrar con Google (la fija `handleOAuth`). */
function destinoDeCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const valor = cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_DESTINO_OAUTH}=([^;]*)`)
  )?.[1];
  if (!valor) return null;
  try {
    return rutaDeRegresoSegura(decodeURIComponent(valor));
  } catch {
    return null;
  }
}

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
  // `?next=` (demo) o, con Google, la cookie del destino: la URL de regreso
  // de OAuth no lleva parametros (ver `handleOAuth`).
  const next =
    rutaDeRegresoSegura(searchParams.get("next")) ?? destinoDeCookie(request) ?? defaultNext;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Si aun no tiene negocio (primera vez con Google), el middleware lo
      // manda a /completar-registro desde el dashboard.
      const respuesta = NextResponse.redirect(`${origin}${next}`);
      respuesta.cookies.delete(LOCALE_OAUTH_COOKIE);
      respuesta.cookies.delete(COOKIE_DESTINO_OAUTH);
      return respuesta;
    }
  }

  const locale = resolveDefaultLocale(request);
  return NextResponse.redirect(`${origin}/${locale}/auth?error=auth`);
}
