/**
 * Helpers para detectar y rechazar al usuario demo desde el servidor.
 *
 * El demo se identifica por el email `demo@symvora.com`. Cualquier endpoint
 * que tenga efectos colaterales externos (pagos, timbrado, invitaciones,
 * rotación de secretos, etc.) debe llamar `assertNotDemo(request)` justo
 * después de la autenticación.
 *
 * Esto NO sustituye a RLS ni a la separación de tenants: es una capa
 * adicional para garantizar que el usuario demo nunca dispare acciones
 * que toquen sistemas externos o que modifiquen la configuración global
 * del tenant demo más allá del snapshot sembrado por `reset_demo_tenant()`.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server.server";

export const DEMO_USER_EMAIL = "demo@symvora.com";

export type DemoGuardResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Lee el usuario actual de la sesión y devuelve si es el usuario demo.
 *
 * No debe usarse como única fuente de verdad en flujos críticos: el email
 * puede mutar en el futuro. Se complementa con la marca `is_demo` que
 * rellena la migración `022_demo_guards.sql` en `auth.users.app_metadata`.
 */
export async function isDemoUser(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // Doble verificación: app_metadata.is_demo (server-controlled) tiene
    // precedencia sobre el email (que en teoría es inmutable, pero por
    // defensa en profundidad mantenemos ambos).
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    if (appMeta.is_demo === true) return true;

    return user.email === DEMO_USER_EMAIL;
  } catch {
    // Si por alguna razón no se puede leer la sesión, devolvemos false.
    // `requireTenantAccess` es el que se encarga de devolver 401 cuando
    // no hay sesión.
    return false;
  }
}

/**
 * Helper "rápido" para endpoints que ya tienen el email del usuario en
 * contexto (por ejemplo tras un `getUser()` previo). Evita una segunda
 * llamada al servidor de Supabase.
 */
export function isDemoUserSync(email: string | null | undefined): boolean {
  return email === DEMO_USER_EMAIL;
}

/**
 * Short-circuit para endpoints sensibles: si el usuario autenticado es
 * el del demo, devuelve 403 con un mensaje claro y aborta el flujo.
 *
 * Uso típico:
 *   const auth = await requireTenantAccess(request, { tenantId });
 *   if (!auth.ok) return auth.response;
 *   const demo = await assertNotDemo();
 *   if (!demo.ok) return demo.response;
 */
export async function assertNotDemo(): Promise<DemoGuardResult> {
  if (await isDemoUser()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Esta acción no está disponible en el modo demo. Crea una cuenta gratuita para probar pagos, facturación e invitaciones.",
          code: "DEMO_MODE_RESTRICTED",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}
