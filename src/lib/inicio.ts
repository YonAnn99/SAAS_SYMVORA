/**
 * La pantalla de inicio de cada usuario, segun lo que puede ver.
 *
 * Todo el sistema manda "al dashboard" tras iniciar sesion (correo, clave de
 * empleado, Google) y el middleware manda ahi a quien entra donde no debe. Pero
 * desde la migracion 088 el cajero no ve el dashboard: son las cifras del
 * negocio. Si el middleware siguiera devolviendolo al dashboard al negarle una
 * ruta, lo mandaria a OTRA ruta negada — un bucle de redirecciones.
 *
 * Por eso el middleware usa esto en lugar de "/dashboard" a pelo: quien puede,
 * al dashboard; quien vende, al Punto de venta; y si no, al catalogo, que esta
 * abierto a todo miembro (`permission: null` en `modules.ts`) y por tanto nunca
 * puede provocar otra redireccion.
 */
export function inicioPara(permisos: readonly string[]): "/dashboard" | "/pos" | "/products" {
  if (permisos.includes("sales.view_reports")) return "/dashboard";
  if (permisos.includes("sales.create")) return "/pos";
  return "/products";
}
