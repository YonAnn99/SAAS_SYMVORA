"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Solo responde a "¿tengo caja abierta?".
 *
 * Existe aparte de `useCashRegister` a proposito: aquel trae la caja, sus
 * movimientos, las ventas del periodo y calcula totales. El encabezado y la
 * guarda del POS solo necesitan un booleano, y montar el hook pesado en cada
 * pantalla del panel dispararia varias consultas por navegacion contra un
 * PostgREST con pool pequeño.
 *
 * Cuenta CUALQUIER caja en estado ABIERTA, aunque sea de dias atras: es la
 * regla de negocio acordada y coincide con lo que hace el resto del sistema.
 */
export interface OpenRegisterState {
  /** `null` mientras se resuelve: no es lo mismo que "no hay caja". */
  hasOpenRegister: boolean | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const CASH_REGISTER_CHANGED_EVENT = "cash-register-status-changed";

export function notifyCashRegisterChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CASH_REGISTER_CHANGED_EVENT));
  }
}

export function useOpenRegister(tenantId: string | null): OpenRegisterState {
  const [hasOpenRegister, setHasOpenRegister] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    // Todo va dentro del try: sin conexion, `getUser()` y la consulta LANZAN,
    // y sin capturarlas la promesa quedaba rechazada sin atender y `loading`
    // se quedaba en `true` para siempre. `hasOpenRegister` sigue en `null`
    // ("no se pudo resolver"), que es justo lo que el POS necesita para no
    // cerrarse: un `false` por fallo de red dejaria al cajero sin vender.
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // `head: true` con `count`: no se traen filas, solo si existe alguna.
      const { count, error } = await supabase
        .from("cajas")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("usuario_id", user.id)
        .eq("estado", "ABIERTA");

      if (error) {
        // Ante un fallo NO se afirma que no hay caja: eso bloquearia el POS y
        // dispararia el aviso de cierre de sesion sin motivo. Se deja sin
        // resolver y quien consuma el hook decide.
        console.error("[use-open-register] fallo la consulta:", error.message);
        setLoading(false);
        return;
      }

      setHasOpenRegister((count ?? 0) > 0);
      setLoading(false);
    } catch (error: unknown) {
      console.error("[use-open-register] sin red:", error);
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    // Diferido, convención del repo: sin tenant, `refetch` llama a `setLoading`
    // de forma síncrona dentro del efecto y eso encadena renders
    // (`react-hooks/set-state-in-effect`).
    const inicial = window.setTimeout(() => void refetch(), 0);

    const handleChanged = () => {
      void refetch();
    };

    window.addEventListener(CASH_REGISTER_CHANGED_EVENT, handleChanged);
    window.addEventListener("focus", handleChanged);

    return () => {
      window.clearTimeout(inicial);
      window.removeEventListener(CASH_REGISTER_CHANGED_EVENT, handleChanged);
      window.removeEventListener("focus", handleChanged);
    };
  }, [refetch]);

  return { hasOpenRegister, loading, refetch };
}
