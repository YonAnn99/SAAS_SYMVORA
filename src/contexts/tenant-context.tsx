"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fijarAlcanceCache, vaciarCache } from "@/lib/cache-datos";
import { vaciarCarritoGuardado } from "@/features/pos/stores/cart";
import type { UserRole } from "@/lib/types/database";
import { nombreCompleto } from "@/lib/nombre-usuario";
import { MONEDA_POR_DEFECTO, monedaDe, type Moneda } from "@/lib/money";

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
  /** `tenants.moneda` (migración 133): cómo se pintan los montos. MXN por defecto. */
  moneda: Moneda;
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
  moneda: MONEDA_POR_DEFECTO,
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
        vaciarCache();
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
           tenants!inner(nombre_comercial, logo_url, direccion, giro_comercial, moneda)`
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
        moneda?: string | null;
      };

      const resuelto = {
        tenantId: membership.tenant_id,
        userId: user.id,
        userName: nombreCompleto(user.user_metadata),
        tenantName: tenantData?.nombre_comercial || "Negocio",
        tenantLogo: tenantData?.logo_url || null,
        tenantAddress: tenantData?.direccion || null,
        tenantGiro: tenantData?.giro_comercial || null,
        moneda: monedaDe(tenantData?.moneda),
        role: membership.role as UserRole,
      };

      // La caché entre módulos va ligada a este usuario y negocio: si cambian,
      // se vacía (ver `lib/cache-datos.ts`).
      fijarAlcanceCache(resuelto.userId, resuelto.tenantId);
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

  // Sesión cerrada (aquí, en otra pestaña o por expirar): fuera la caché y la
  // venta en curso guardada en la pestaña.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") {
        vaciarCache();
        vaciarCarritoGuardado();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TenantContext.Provider value={{ ...state, refetch: fetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * La moneda del negocio, sin exigir el proveedor: fuera del panel (pruebas,
 * páginas públicas) devuelve MXN en vez de romper.
 */
export function useMonedaDelNegocio(): Moneda {
  return useContext(TenantContext)?.moneda ?? MONEDA_POR_DEFECTO;
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenantContext must be used within a TenantProvider");
  }
  return ctx;
}
