"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";
import { nombreCompleto } from "@/lib/nombre-usuario";

export interface TenantInfo {
  tenantId: string;
  /** Id del cajero. Lo firman las ventas que cobra. */
  userId: string;
  /** Nombre de la persona (ver `nombreCompleto`); "" si no capturó ninguno. */
  userName: string;
  tenantName: string;
  tenantLogo: string | null;
  /** Domicilio del negocio. Lo imprime el pie del ticket del POS. */
  tenantAddress: string | null;
  /** `tenants.giro_comercial` (ROPA, ABARROTES...): sugiere atributos de variante. */
  tenantGiro: string | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

interface TenantContextValue extends TenantInfo {
  refetch: () => Promise<void>;
}

const EMPTY_STATE: TenantInfo = {
  tenantId: "",
  userId: "",
  userName: "",
  tenantName: "",
  tenantLogo: null,
  tenantAddress: null,
  tenantGiro: null,
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

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user ?? null;

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
           tenants!inner(nombre_comercial, logo_url, direccion, giro_comercial)`
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
        direccion: string | null;
        giro_comercial: string | null;
      };

      const resuelto = {
        tenantId: membership.tenant_id,
        userId: user.id,
        userName: nombreCompleto(user.user_metadata),
        tenantName: tenantData?.nombre_comercial || "Negocio",
        tenantLogo: tenantData?.logo_url || null,
        tenantAddress: tenantData?.direccion || null,
        tenantGiro: tenantData?.giro_comercial || null,
        role: membership.role as UserRole,
      };

      setState({ ...resuelto, loading: false, error: null });
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
