"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  INFO_PLAN_HEREDADO,
  leerInfoPlan,
  permiteFuncion,
  puedeAgregarSucursal,
  type FuncionDePlan,
  type InfoPlan,
} from "@/lib/niveles";

/**
 * Nivel de suscripción del negocio y lo que incluye (migración 140, `info_plan`).
 *
 * Un store compartido y no un fetch por componente: lo leen el menú, el dock, el POS, Clientes, Catálogo y
 * Sucursales, y todos tienen que cambiar a la vez cuando cambia el nivel (`refrescar`).
 *
 * ESTO SOLO ESCONDE. La regla de verdad la aplican los triggers de la base (`limite_sucursales`,
 * `plan_sin_lealtad`, `plan_sin_catalogo`): ni saltándose la interfaz se rebasa el nivel. Por eso, mientras
 * carga o si falla la red, se asume el plan heredado (todo permitido): un fallo de red nunca esconde
 * módulos a quien sí los tiene.
 */
interface PlanStore {
  tenantId: string | null;
  info: InfoPlan;
  /** `true` cuando ya se sabe el nivel (o se dio por heredado tras un fallo). */
  listo: boolean;
  cargando: boolean;
  cargar: (tenantId: string, forzar?: boolean) => Promise<void>;
}

const usePlanStore = create<PlanStore>((set, get) => ({
  tenantId: null,
  info: INFO_PLAN_HEREDADO,
  listo: false,
  cargando: false,
  cargar: async (tenantId, forzar = false) => {
    const estado = get();
    if (estado.cargando) return;
    if (!forzar && estado.tenantId === tenantId && estado.listo) return;
    set(
      estado.tenantId === tenantId
        ? { cargando: true }
        : // Otro negocio: lo del anterior no vale ni un instante.
          { cargando: true, tenantId, info: INFO_PLAN_HEREDADO, listo: false }
    );
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("info_plan", { p_tenant_id: tenantId });
      if (error) throw error;
      set({ tenantId, info: leerInfoPlan(data), listo: true });
    } catch {
      set({ tenantId, info: INFO_PLAN_HEREDADO, listo: true });
    } finally {
      set({ cargando: false });
    }
  },
}));

export function usePlan() {
  const { tenantId } = useCurrentTenant();
  const { info, listo, cargar } = usePlanStore();

  useEffect(() => {
    if (tenantId) void cargar(tenantId);
  }, [tenantId, cargar]);

  const refrescar = useCallback(async () => {
    if (tenantId) await cargar(tenantId, true);
  }, [tenantId, cargar]);

  const permite = useCallback(
    (funcion: FuncionDePlan) => permiteFuncion(info.funciones, funcion),
    [info.funciones]
  );

  return {
    nivel: info.funciones.nivel,
    funciones: info.funciones,
    sucursalesUsadas: info.sucursalesUsadas,
    puedeAgregarSucursal: puedeAgregarSucursal(info.funciones, info.sucursalesUsadas),
    listo,
    permite,
    refrescar,
  };
}
