"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  loading: boolean;
  error: string | null;
}

export function useCurrentTenant(): TenantInfo {
  const [state, setState] = useState<TenantInfo>({
    tenantId: "",
    tenantName: "",
    tenantLogo: null,
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
        setState({
          tenantId: "",
          tenantName: "",
          tenantLogo: null,
          loading: false,
          error: "No autenticado",
        });
        return;
      }

      const { data: membership, error } = await supabase
        .from("tenant_memberships")
        .select(
          `tenant_id, 
           tenants!inner(nombre_comercial, logo_url)`
        )
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !membership) {
        setState({
          tenantId: "",
          tenantName: "",
          tenantLogo: null,
          loading: false,
          error: "No se encontró tenant",
        });
        return;
      }

      const tenantData = membership.tenants as unknown as {
        nombre_comercial: string;
        logo_url: string | null;
      };

      setState({
        tenantId: membership.tenant_id,
        tenantName: tenantData?.nombre_comercial || "Negocio",
        tenantLogo: tenantData?.logo_url || null,
        loading: false,
        error: null,
      });
    } catch {
      setState({
        tenantId: "",
        tenantName: "",
        tenantLogo: null,
        loading: false,
        error: "Error al obtener tenant",
      });
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchTenant();
    };
    load();
  }, [fetchTenant]);

  return state;
}
