"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  fetchSucursales,
  type Sucursal,
} from "@/features/sucursales/services/sucursales-service";
import { resolverSeleccion } from "@/features/sucursales/seleccion";

/**
 * Que sucursal esta mirando el usuario ahora mismo.
 *
 * `seleccionada === null` significa **"Todas"**, y es el valor por defecto a
 * proposito: un negocio de un solo local no debe notar que esta funcion existe,
 * y el dueño de varios casi siempre quiere el consolidado al entrar.
 *
 * ESTO NO ES UN PERMISO. Elegir sucursal solo acota lo que se CONSULTA; quien
 * decide lo que se puede ver sigue siendo RLS. Cambiar aqui de local no da
 * acceso a nada nuevo: todas las sucursales de la lista son ya de un negocio
 * del que el usuario es miembro.
 */

interface SucursalContextValue {
  sucursales: Sucursal[];
  /** Solo las que siguen abiertas: es lo que se ofrece para elegir. */
  activas: Sucursal[];
  /** `null` = todas las sucursales juntas. */
  seleccionada: string | null;
  setSeleccionada: (id: string | null) => void;
  /** `false` en un negocio de un solo local: la interfaz se calla. */
  hayVarias: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const SucursalContext = createContext<SucursalContextValue | null>(null);

const CLAVE = "symvora_sucursal";

function leerGuardada(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    // Modo privado o almacenamiento bloqueado: se comporta como "Todas".
    return null;
  }
}

function guardar(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CLAVE, id);
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Que no se pueda recordar la eleccion no es motivo para romper la pantalla.
  }
}

export function SucursalProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [seleccionada, setSeleccionadaState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const lista = await fetchSucursales(tenantId);
      setSucursales(lista);

      // La elección guardada se VALIDA contra la lista recién traída: ver el
      // porqué en `resolverSeleccion`.
      setSeleccionadaState(resolverSeleccion(leerGuardada(), lista));
    } catch {
      // Sin sucursales la aplicacion funciona igual que antes de que existieran:
      // todo el negocio junto. No se muestra un error por esto.
      setSucursales([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Diferido con setTimeout, convención del repo (misma que `use-cash-register`
  // y `promo-badge`): llamar a setState de forma síncrona dentro del efecto
  // encadena renders y lo marca `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (tenantLoading) return;
    const t0 = window.setTimeout(() => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      void cargar();
    }, 0);
    return () => window.clearTimeout(t0);
  }, [tenantId, tenantLoading, cargar]);

  const setSeleccionada = useCallback((id: string | null) => {
    setSeleccionadaState(id);
    guardar(id);
  }, []);

  const activas = useMemo(
    () => sucursales.filter((s) => s.activa),
    [sucursales]
  );

  const valor = useMemo<SucursalContextValue>(
    () => ({
      sucursales,
      activas,
      seleccionada,
      setSeleccionada,
      // Con una sola sucursal no hay nada que elegir, asi que el selector no se
      // dibuja y el negocio de un solo local no ve ninguna friccion nueva.
      hayVarias: activas.length > 1,
      loading,
      refetch: cargar,
    }),
    [sucursales, activas, seleccionada, setSeleccionada, loading, cargar]
  );

  return (
    <SucursalContext.Provider value={valor}>{children}</SucursalContext.Provider>
  );
}

/**
 * Devuelve un estado neutro si no hay proveedor por encima, en vez de reventar.
 *
 * Es deliberado y distinto de `useTenantContext`, que si lanza: sin tenant no se
 * puede consultar nada, pero sin sucursal se consulta el negocio entero, que es
 * exactamente el comportamiento que habia antes de esta funcion. Asi el punto de
 * venta o un dialogo suelto pueden usar el hook sin arrastrar el proveedor.
 */
export function useSucursal(): SucursalContextValue {
  const ctx = useContext(SucursalContext);
  return (
    ctx ?? {
      sucursales: [],
      activas: [],
      seleccionada: null,
      setSeleccionada: () => {},
      hayVarias: false,
      loading: false,
      refetch: async () => {},
    }
  );
}
