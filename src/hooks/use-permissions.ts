"use client";

/**
 * Permisos EFECTIVOS del usuario actual: los de su rol, más los concedidos
 * manualmente por el SUPER_ADMIN, menos los que le hayan quitado.
 *
 * Sustituye al chequeo por rol (`hasRole`) en las capas de interfaz. El rol
 * sigue existiendo y sigue siendo la base, pero desde la migración 055 ya no
 * cuenta toda la historia: dos ORG_ADMIN pueden tener accesos distintos.
 *
 * La misma cuenta la hace `get_effective_permissions()` en la base de datos,
 * que es la que vale. Esto es solo para decidir qué se pinta.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";

export interface PermissionsState {
  permissions: Set<string>;
  loading: boolean;
  /** `true` si el permiso está en el conjunto efectivo. */
  can: (permission: string | null) => boolean;
  refetch: () => Promise<void>;
}

export function usePermissions(): PermissionsState {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_effective_permissions", {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      setPermissions(
        new Set((data ?? []).map((r: { permission: string }) => r.permission))
      );
    } catch (error) {
      // Ante un fallo se deja el conjunto vacío: la interfaz mostrará de menos,
      // nunca de más. Las escrituras están protegidas por RLS de todos modos.
      console.error("[permissions] no se pudieron leer:", error);
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    // Diferido igual que en use-pos-catalog y use-online-status: llamar a
    // setState de forma síncrona dentro del efecto encadena renders
    // (react-hooks/set-state-in-effect).
    const timeout = window.setTimeout(() => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      void fetchPermissions();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [tenantId, tenantLoading, fetchPermissions]);

  const can = useCallback(
    // `null` significa "módulo abierto a todo miembro del negocio".
    (permission: string | null) => permission === null || permissions.has(permission),
    [permissions]
  );

  return { permissions, loading: loading || tenantLoading, can, refetch: fetchPermissions };
}
