/**
 * Flags para módulos deshabilitados temporalmente sin borrar su código.
 *
 * El middleware (`src/lib/supabase/middleware.ts`, `DISABLED_PATHS`) ya
 * bloquea la navegación a las páginas, pero no cubre `/api/**`. Este
 * guard cierra ese hueco para los endpoints correspondientes.
 */

import { NextResponse } from "next/server";

export const FACTURAS_MODULE_ENABLED = false;

export type FeatureGuardResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Short-circuit para los endpoints de `/api/facturas/**`.
 *
 * Uso típico (primera línea del handler, antes de leer el body o
 * autenticar):
 *   const facturas = assertFacturasEnabled();
 *   if (!facturas.ok) return facturas.response;
 */
export function assertFacturasEnabled(): FeatureGuardResult {
  if (!FACTURAS_MODULE_ENABLED) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "El módulo de facturación no está disponible por el momento." },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}
