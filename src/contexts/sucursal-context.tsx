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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchSucursales,
  type Sucursal,
} from "@/features/sucursales/services/sucursales-service";
import {
  resolverSeleccion,
  seleccionEfectiva,
} from "@/features/sucursales/seleccion";

/**
 * Que sucursal esta mirando el usuario ahora mismo, y cuales puede mirar.
 *
 * `seleccionada === null` significa **"Todas"**, y es el valor por defecto a
 * proposito: un negocio de un solo local no debe notar que esta funcion existe,
 * y el dueño de varios casi siempre quiere el consolidado al entrar.
 *
 * PERMITIDAS (migracion 085). Un usuario puede tener asignadas solo algunas
 * sucursales. Aqui se exponen solo esas para elegir y operar; "Todas", para el,
 * son todas LAS SUYAS. Pero esto es comodidad, no la proteccion: quien decide lo
 * que se puede leer y escribir es la base (`mis_sucursales()` en las politicas
 * RLS y en las funciones). Si esta lista se equivocara, la base seguiria
 * negandole lo ajeno.
 */

interface SucursalContextValue {
  /** Todas las del negocio, incluidas cerradas y ajenas: para poner nombres. */
  sucursales: Sucursal[];
  /** Las ABIERTAS que el usuario puede usar: lo que se ofrece para elegir. */
  activas: Sucursal[];
  /** Todas las abiertas del negocio. Destinos de traspaso (se puede enviar a cualquiera). */
  todasActivas: Sucursal[];
  /** Ids que el usuario tiene permitidos (incluye cerradas, para su historico). */
  permitidas: string[];
  /** `true` si tiene asignadas solo algunas sucursales del negocio. */
  restringido: boolean;
  /** `null` = todas las sucursales (las suyas) juntas. */
  seleccionada: string | null;
  setSeleccionada: (id: string | null) => void;
  /** `false` con un solo local disponible: la interfaz se calla. */
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
  const [permitidas, setPermitidas] = useState<string[]>([]);
  const [seleccionada, setSeleccionadaState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const [lista, { data: mias, error }] = await Promise.all([
        fetchSucursales(tenantId),
        supabase.rpc("mis_sucursales"),
      ]);
      if (error) throw error;

      // `mis_sucursales` cubre todos los negocios del usuario: se acota a este.
      const idsNegocio = new Set(lista.map((s) => s.id));
      const propias = ((mias ?? []) as string[]).filter((id) => idsNegocio.has(id));

      setSucursales(lista);
      setPermitidas(propias);

      // La eleccion guardada se VALIDA contra lo permitido: una sucursal que ya
      // no existe, que es de otro negocio o que se le quito al usuario, cae a
      // "Todas" (ver `resolverSeleccion`).
      setSeleccionadaState(
        resolverSeleccion(leerGuardada(), propias.map((id) => ({ id })))
      );
    } catch {
      // Sin sucursales la aplicacion funciona igual que antes de que existieran:
      // todo el negocio junto. No se muestra un error por esto.
      setSucursales([]);
      setPermitidas([]);
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

  const valor = useMemo<SucursalContextValue>(() => {
    const idsPermitidos = new Set(permitidas);
    const activas = sucursales.filter((s) => s.activa && idsPermitidos.has(s.id));
    const todasActivas = sucursales.filter((s) => s.activa);
    const restringido =
      sucursales.length > 0 && sucursales.some((s) => !idsPermitidos.has(s.id));
    // Con un solo local disponible no hay nada que elegir, asi que el selector
    // no se dibuja y el negocio de un solo local no ve ninguna friccion nueva.
    const hayVarias = activas.length > 1;
    return {
      sucursales,
      activas,
      todasActivas,
      permitidas,
      restringido,
      seleccionada: seleccionEfectiva({ seleccionada, activas, hayVarias, restringido }),
      setSeleccionada,
      hayVarias,
      loading,
      refetch: cargar,
    };
  }, [sucursales, permitidas, seleccionada, setSeleccionada, loading, cargar]);

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
      todasActivas: [],
      permitidas: [],
      restringido: false,
      seleccionada: null,
      setSeleccionada: () => {},
      hayVarias: false,
      loading: false,
      refetch: async () => {},
    }
  );
}
