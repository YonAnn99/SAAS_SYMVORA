"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface TenantInfo {
  tenantId: string;
  loading: boolean;
  error: string | null;
}

export function useCurrentTenant(): TenantInfo {
  const [state, setState] = useState<TenantInfo>({
    tenantId: "",
    loading: true,
    error: null,
  });

  const fetchTenant = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ tenantId: "", loading: false, error: "No autenticado" });
        return;
      }

      const { data: membership, error } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !membership) {
        setState({ tenantId: "", loading: false, error: "No se encontró tenant" });
        return;
      }

      setState({ tenantId: membership.tenant_id, loading: false, error: null });
    } catch {
      setState({ tenantId: "", loading: false, error: "Error al obtener tenant" });
    }
  }, []);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  return state;
}
