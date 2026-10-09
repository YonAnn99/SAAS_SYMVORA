/**
 * "A donde regresar despues de iniciar sesion".
 *
 * Quien abre un enlace del panel sin sesion (p. ej. «Reactivar mi acceso» del
 * correo de fin de prueba, que lleva a /billing) pasa por el login y debe
 * volver a ESA pagina, no al dashboard. El destino viaja en `?next=` (o en la
 * cookie `oauth_next` con Google), asi que cualquiera puede escribirlo: solo se
 * acepta una ruta interna con idioma, nunca otro dominio (open redirect).
 */

/** Cookie corta que guarda el destino durante el viaje a Google y de regreso. */
export const COOKIE_DESTINO_OAUTH = "oauth_next";

const RUTAS_DE_AUTH = ["/auth", "/login", "/signup", "/reset-password"];

export function rutaDeRegresoSegura(valor: string | null | undefined): string | null {
  if (!valor) return null;

  // Barras dobles o invertidas las interpreta el navegador como otro host
  // (`//evil.com`, `/\evil.com`); los caracteres de control se cuelan en
  // cabeceras. Nada de eso cabe en una ruta del panel.
  if (valor.includes("//") || valor.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(valor)) return null;

  const coincide = valor.match(/^\/(es|en)(\/[^?#]*)?([?#].*)?$/);
  if (!coincide) return null;

  // Volver al login despues del login seria un bucle.
  const ruta = coincide[2] ?? "";
  if (RUTAS_DE_AUTH.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;

  return valor;
}

/**
 * URL del login para quien llega sin sesion a `pathname` (+ `search`). El
 * idioma sale de la ruta; si no es valido, español.
 */
export function urlDeLogin(pathname: string, search = ""): string {
  const idioma = pathname.split("/")[1];
  const locale = idioma === "en" ? "en" : "es";
  const destino = rutaDeRegresoSegura(`${pathname}${search}`);
  const params = new URLSearchParams({ mode: "login" });
  if (destino) params.set("next", destino);
  return `/${locale}/auth?${params.toString()}`;
}
