"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "@/i18n/navigation";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsDemo } from "@/hooks/use-is-demo";
import { stripLocale } from "@/lib/navigation";
import {
  ESTADO_VACIO,
  claveNovedades,
  esNuevo,
  leerEstado,
  novedadPorMostrar,
  novedadesPara,
  type EstadoNovedades,
} from "@/lib/novedades";

/**
 * Estado de las novedades (`lib/novedades.ts`) para el menú, el dock y la
 * ventana. Lo comparten varios componentes a la vez: al abrir el módulo en uno,
 * la etiqueta se quita en los demás sin recargar (`useSyncExternalStore` sobre
 * `localStorage`, con aviso propio porque el evento `storage` solo llega a las
 * OTRAS pestañas).
 */

const oyentes = new Set<() => void>();
// Instantánea estable: se vuelve a parsear solo si cambió el texto guardado.
let cache: { clave: string; texto: string | null; estado: EstadoNovedades } | null = null;

function leer(clave: string): EstadoNovedades {
  let texto: string | null = null;
  try {
    texto = window.localStorage.getItem(clave);
  } catch {
    // Modo privado o almacenamiento bloqueado: se comporta como nunca visto.
  }
  if (cache?.clave === clave && cache.texto === texto) return cache.estado;
  const estado = leerEstado(texto);
  cache = { clave, texto, estado };
  return estado;
}

function suscribir(aviso: () => void) {
  oyentes.add(aviso);
  window.addEventListener("storage", aviso);
  return () => {
    oyentes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

function marcar(clave: string, campo: keyof EstadoNovedades, id: string) {
  const actual = leer(clave);
  if (actual[campo].includes(id)) return;
  try {
    window.localStorage.setItem(clave, JSON.stringify({ ...actual, [campo]: [...actual[campo], id] }));
  } catch {
    return;
  }
  oyentes.forEach((aviso) => aviso());
}

export function useNovedades() {
  const { userId, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permisosLoading } = usePermissions();
  const isDemo = useIsDemo();
  const ruta = stripLocale(usePathname());
  const clave = userId ? claveNovedades(userId) : null;

  const estado = useSyncExternalStore(
    suscribir,
    () => (clave ? leer(clave) : ESTADO_VACIO),
    () => ESTADO_VACIO
  );

  const listo = !tenantLoading && !permisosLoading && Boolean(clave) && !isDemo;
  const activas = useMemo(() => (listo ? novedadesPara(new Date(), can) : []), [listo, can]);

  // Entrar al módulo cuenta como visto, llegue por donde llegue.
  useEffect(() => {
    if (!clave) return;
    const enModulo = activas.find((n) => n.href === ruta);
    if (enModulo) marcar(clave, "vistas", enModulo.id);
  }, [clave, activas, ruta]);

  const nuevo = useCallback((href: string) => esNuevo(href, activas, estado), [activas, estado]);
  const vista = useCallback((id: string) => clave && marcar(clave, "vistas", id), [clave]);
  const descartar = useCallback((id: string) => clave && marcar(clave, "descartadas", id), [clave]);

  return {
    esNuevo: nuevo,
    porMostrar: novedadPorMostrar(activas, estado),
    marcarVista: vista,
    descartar,
  };
}
