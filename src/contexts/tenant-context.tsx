"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

interface TenantContextValue extends TenantInfo {
  refetch: () => Promise<void>;
}

const EMPTY_STATE: TenantInfo = {
  tenantId: "",
  tenantName: "",
  tenantLogo: null,
  role: null,
  loading: true,
  error: null,
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TenantInfo>(EMPTY_STATE);

  const fetchTenant = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({
          ...EMPTY_STATE,
          loading: false,
          error: "No autenticado",
        });
        return;
      }

      const { data: membership, error } = await supabase
        .from("tenant_memberships")
        .select(
          `tenant_id, role,
           tenants!inner(nombre_comercial, logo_url)`
        )
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !membership) {
        setState({
          ...EMPTY_STATE,
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
        role: membership.role as UserRole,
        loading: false,
        error: null,
      });
    } catch {
      setState({
        ...EMPTY_STATE,
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

  return (
    <TenantContext.Provider value={{ ...state, refetch: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenantContext must be used within a TenantProvider");
  }
  return ctx;
}
