"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  TODOS_ENCENDIDOS,
  normalizarModulos,
  type ClaveModulo,
  type Modulos,
} from "@/lib/modulos";

/**
 * Modulos activos del negocio (ver `@/lib/modulos`).
 *
 * Un store compartido y no un fetch por componente: los leen el POS, el
 * dialogo de producto, las pestañas de Productos y los ajustes, y todos deben
 * cambiar en cuanto el dueño mueve un interruptor en Configuracion
 * (`setModulo`), sin recargar.
 *
 * Mientras carga (o si falla) devuelve TODOS encendidos: no se esconde nada
 * por un fallo de red.
 */
interface ModulosStore {
  tenantId: string | null;
  modulos: Modulos;
  cargando: boolean;
  cargar: (tenantId: string) => Promise<void>;
  setModulo: (clave: ClaveModulo, valor: boolean) => void;
}

const useModulosStore = create<ModulosStore>((set, get) => ({
  tenantId: null,
  modulos: TODOS_ENCENDIDOS,
  cargando: false,
  cargar: async (tenantId) => {
    if (get().tenantId === tenantId || get().cargando) return;
    set({ cargando: true });
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("tenant_settings")
        .select("configuracion_json")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const json = (data?.configuracion_json ?? null) as { modulos_activos?: unknown } | null;
      set({ tenantId, modulos: normalizarModulos(json?.modulos_activos) });
    } catch {
      set({ tenantId, modulos: TODOS_ENCENDIDOS });
    } finally {
      set({ cargando: false });
    }
  },
  setModulo: (clave, valor) => set((s) => ({ modulos: { ...s.modulos, [clave]: valor } })),
}));

export function useModulos() {
  const { tenantId } = useCurrentTenant();
  const { modulos, cargar, setModulo } = useModulosStore();

  useEffect(() => {
    if (tenantId) void cargar(tenantId);
  }, [tenantId, cargar]);

  return { modulos, setModulo };
}
