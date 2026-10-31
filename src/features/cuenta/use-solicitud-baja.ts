"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { solicitudQueBloquea, type SolicitudBaja } from "./baja";

const EVENTO = "symvora:baja-cambio";

/** Avisa al panel que se pidio o cancelo una baja, para que se bloquee o libere sin recargar. */
export function avisarCambioDeBaja() {
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * La solicitud de baja que afecta a esta persona (la suya o la del negocio).
 * La RLS de `solicitudes_baja` ya deja ver solo esas dos.
 */
export function useSolicitudBaja() {
  const { userId, tenantId, loading } = useCurrentTenant();
  const [estado, setEstado] = useState<ReturnType<typeof solicitudQueBloquea>>(null);

  const cargar = useCallback(async () => {
    if (!userId || !tenantId) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("solicitudes_baja")
      .select("id, user_id, tenant_id, es_dueno, ejecutar_en, cancelada_en, ejecutada_en")
      .is("cancelada_en", null)
      .is("ejecutada_en", null);
    // Si falla la consulta no se bloquea nadie: es un aviso, no la proteccion.
    if (error) return;
    setEstado(solicitudQueBloquea((data ?? []) as SolicitudBaja[], userId, tenantId));
  }, [userId, tenantId]);

  useEffect(() => {
    if (loading) return;
    const t = window.setTimeout(() => void cargar(), 0);
    window.addEventListener(EVENTO, cargar);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENTO, cargar);
    };
  }, [loading, cargar]);

  return { baja: estado, recargar: cargar };
}
