import { NextResponse } from "next/server";

/**
 * Digital Asset Links: prueba que la app de Android (una TWA, Trusted Web
 * Activity) y este dominio son del mismo dueño. Sin esto, la app abre SYMVORA
 * con la barra de direcciones de Chrome, como si fuera un navegador.
 *
 * Se sirve en TODOS los hosts (app., www., demo.): el `matcher` de `proxy.ts`
 * salta las rutas con punto, asi que el middleware no la toca.
 *
 * Variables (Vercel → Production; cambiarlas requiere redeploy):
 * - `ANDROID_APP_PACKAGE`: nombre del paquete. Por defecto `com.symvora.app`.
 * - `ANDROID_APP_SHA256`: huella(s) SHA-256 de la llave con que Google firma la
 *   app (Play Console → Configuracion → Integridad de la app → «Certificado de
 *   la clave de firma de apps»). Separadas por coma si hay varias (por ejemplo
 *   la de Play y la de una compilacion de prueba local). Sin ella, lista vacia.
 */
export function GET() {
  const paquete = process.env.ANDROID_APP_PACKAGE?.trim() || "com.symvora.app";
  const huellas = (process.env.ANDROID_APP_SHA256 ?? "")
    .split(",")
    .map((h) => h.trim().toUpperCase())
    .filter((h) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(h));

  const cuerpo =
    huellas.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: paquete,
              sha256_cert_fingerprints: huellas,
            },
          },
        ];

  return NextResponse.json(cuerpo, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
