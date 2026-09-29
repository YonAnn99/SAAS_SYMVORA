"use client";

/**
 * Acceso de la cuenta (completo / gracia / solo lectura) para la interfaz.
 *
 * Manda la base: `mi_acceso_cuenta()` (migracion 096). Si esa funcion aun no
 * existe se calcula con el espejo en TypeScript, que da el mismo resultado.
 * Las fechas salen de `subscriptions` (con `*` para no romper si faltan las
 * columnas nuevas).
 */

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  calcularAcceso,
  diasDeGracia,
  limiteConservacion,
  type Acceso,
  type DatosAcceso,
} from "@/lib/acceso-suscripcion";

export interface AccesoCuenta {
  loading: boolean;
  acceso: Acceso;
  /** `tenants.subscription_status` */
  estado: string | null;
  diasGracia: number;
  /** Hasta cuando puede descargar sus datos (y usar la oferta de regreso). */
  limiteDatos: Date | null;
  ofertaRegresoHasta: Date | null;
}

const INICIAL: AccesoCuenta = {
  loading: true,
  acceso: "completo",
  estado: null,
  diasGracia: 0,
  limiteDatos: null,
  ofertaRegresoHasta: null,
};

export function useAccesoCuenta(): AccesoCuenta {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [estado, setEstado] = useState<AccesoCuenta>(INICIAL);

  useEffect(() => {
    if (tenantLoading || !tenantId) return;
    let cancelado = false;

    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: tenant }, { data: sub }, rpc] = await Promise.all([
        supabase.from("tenants").select("subscription_status").eq("id", tenantId).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).maybeSingle(),
        supabase.rpc("mi_acceso_cuenta"),
      ]);
      if (cancelado) return;

      const fila = (sub ?? {}) as Record<string, string | null | undefined>;
      const datos: DatosAcceso = {
        estado: (tenant?.subscription_status as string | null) ?? null,
        trial_end: fila.trial_end ?? null,
        current_period_end: fila.current_period_end ?? null,
        past_due_desde: fila.past_due_desde ?? null,
        updated_at: fila.updated_at ?? null,
      };
      const desdeBase = rpc.error ? null : (rpc.data as Acceso | null);
      const oferta = fila.oferta_regreso_hasta ? new Date(fila.oferta_regreso_hasta) : null;

      setEstado({
        loading: false,
        acceso: desdeBase ?? calcularAcceso(datos),
        estado: datos.estado,
        diasGracia: diasDeGracia(datos),
        limiteDatos: limiteConservacion(datos),
        ofertaRegresoHasta: oferta && oferta >= new Date() ? oferta : null,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [tenantId, tenantLoading]);

  return estado;
}
