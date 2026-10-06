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
  /**
   * `pos_config.terminal_externa`: el negocio declaró una terminal de tarjeta
   * no integrada. Vive aquí porque sale del mismo `configuracion_json` y así
   * el POS cambia en cuanto el dueño mueve el interruptor. `null` = cargando.
   */
  terminalExterna: boolean | null;
  cargando: boolean;
  cargar: (tenantId: string) => Promise<void>;
  setModulo: (clave: ClaveModulo, valor: boolean) => void;
  setTerminalExterna: (valor: boolean) => void;
}

const useModulosStore = create<ModulosStore>((set, get) => ({
  tenantId: null,
  modulos: TODOS_ENCENDIDOS,
  terminalExterna: null,
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
      const json = (data?.configuracion_json ?? null) as {
        modulos_activos?: unknown;
        pos_config?: { terminal_externa?: unknown } | null;
      } | null;
      set({
        tenantId,
        modulos: normalizarModulos(json?.modulos_activos),
        terminalExterna: json?.pos_config?.terminal_externa === true,
      });
    } catch {
      // Ante un fallo de red no se bloquea "Tarjeta": misma regla que los modulos.
      set({ tenantId, modulos: TODOS_ENCENDIDOS, terminalExterna: true });
    } finally {
      set({ cargando: false });
    }
  },
  setModulo: (clave, valor) => set((s) => ({ modulos: { ...s.modulos, [clave]: valor } })),
  setTerminalExterna: (valor) => set({ terminalExterna: valor }),
}));

export function useModulos() {
  const { tenantId } = useCurrentTenant();
  const { modulos, terminalExterna, cargar, setModulo, setTerminalExterna } = useModulosStore();

  useEffect(() => {
    if (tenantId) void cargar(tenantId);
  }, [tenantId, cargar]);

  return { modulos, setModulo, terminalExterna, setTerminalExterna };
}
