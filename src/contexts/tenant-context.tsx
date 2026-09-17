"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";
import {
  borrarSesionOffline,
  esFalloDeRed,
  guardarSesionOffline,
  leerSesionOffline,
} from "@/lib/offline/session-snapshot";

export interface TenantInfo {
  tenantId: string;
  /** Id del cajero. Lo necesita la cola de ventas offline. */
  userId: string;
  tenantName: string;
  tenantLogo: string | null;
  /** Domicilio del negocio. Lo imprime el pie del ticket del POS. */
  tenantAddress: string | null;
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
  tenantName: "",
  tenantLogo: null,
  tenantAddress: null,
  role: null,
  loading: true,
  error: null,
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TenantInfo>(EMPTY_STATE);

  /**
   * Cae a la instantanea guardada cuando el fallo es de RED.
   *
   * Sin esto, el Punto de Venta sin conexion es inservible: se queda sin
   * `tenantId`, y con el se va la clave de la cache del catalogo y el `userId`
   * con el que se firman las ventas encoladas.
   */
  const restaurarDesdeInstantanea = useCallback((motivo: unknown): boolean => {
    if (!esFalloDeRed(motivo)) {
      // La sesion ya no vale. Borrar es obligatorio: en un mostrador
      // compartido, heredar el negocio del cajero anterior seria peor que no
      // funcionar.
      borrarSesionOffline();
      return false;
    }

    const guardada = leerSesionOffline();
    if (!guardada) return false;

    setState({
      tenantId: guardada.tenantId,
      userId: guardada.userId,
      tenantName: guardada.tenantName,
      tenantLogo: guardada.tenantLogo,
      tenantAddress: guardada.tenantAddress,
      role: guardada.role,
      loading: false,
      // `offline` es un estado distinto de un error: la pantalla puede seguir
      // trabajando con estos datos, solo que pueden estar viejos.
      error: "offline",
    });
    return true;
  }, []);

  const fetchTenant = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      // `getSession()` lee el token del almacenamiento local y NO toca la red;
      // `getUser()` si la toca. Se usa el primero como respaldo para poder
      // identificar al cajero en modo avion.
      const { data: sesion } = await supabase.auth.getSession();

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData?.user ?? null;

      if (!user) {
        // Sin red, `getUser()` falla aunque la sesion siga siendo valida.
        if (userError && restaurarDesdeInstantanea(userError)) return;
        if (!userError && !sesion?.session && restaurarDesdeInstantanea(null)) {
          return;
        }
        borrarSesionOffline();
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
           tenants!inner(nombre_comercial, logo_url, direccion)`
        )
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !membership) {
        // La consulta tambien necesita red: si se cayo a mitad, la instantanea
        // sigue siendo mejor que dejar al cajero sin negocio.
        if (restaurarDesdeInstantanea(error)) return;
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
      };

      const resuelto = {
        tenantId: membership.tenant_id,
        userId: user.id,
        tenantName: tenantData?.nombre_comercial || "Negocio",
        tenantLogo: tenantData?.logo_url || null,
        tenantAddress: tenantData?.direccion || null,
        role: membership.role as UserRole,
      };

      // Se guarda EN CADA carga con exito: es la unica forma de que el dato
      // este fresco cuando llegue el corte de red, que no avisa.
      guardarSesionOffline(resuelto);

      setState({ ...resuelto, loading: false, error: null });
    } catch (error: unknown) {
      if (restaurarDesdeInstantanea(error)) return;
      setState({
        ...EMPTY_STATE,
        loading: false,
        error: "Error al obtener tenant",
      });
    }
  }, [restaurarDesdeInstantanea]);

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
