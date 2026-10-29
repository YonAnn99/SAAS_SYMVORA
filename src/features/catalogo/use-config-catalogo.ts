"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizarTelefonoMx } from "@/lib/whatsapp";
import { getSiteUrl } from "@/lib/site";
import { guardarConfigCatalogo, obtenerConfigCatalogo } from "./catalogo-service";
import { slugDesdeNombre, slugValido } from "./slug";
import type { CatalogoConfig } from "./types";

/** Slug inicial: el nombre del negocio, o uno genérico si el nombre no sirve. */
function slugInicial(nombre: string, tenantId: string): string {
  const desdeNombre = slugDesdeNombre(nombre);
  return slugValido(desdeNombre) ? desdeNombre : `negocio-${tenantId.slice(0, 6)}`;
}

const suscribirNada = () => () => {};

/**
 * Base del enlace público: www en producción; en `localhost`, el propio
 * servidor de desarrollo (si no, probar en local mandaba a producción, donde el
 * catálogo aún no existe).
 */
export function useBaseCatalogo(): string {
  return useSyncExternalStore(
    suscribirNada,
    () => (window.location.hostname === "localhost" ? window.location.origin : getSiteUrl()),
    () => getSiteUrl()
  );
}

/**
 * Configuración del catálogo del negocio (`catalogos_en_linea`). Si nunca se
 * ha guardado, `guardado` es null y `borrador` trae lo sugerido: el enlace
 * desde el nombre y el WhatsApp desde el teléfono del negocio.
 */
export function useConfigCatalogo() {
  const { tenantId, tenantName } = useCurrentTenant();
  const [guardado, setGuardado] = useState<CatalogoConfig | null>(null);
  const [borrador, setBorrador] = useState<CatalogoConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let vigente = true;
    void (async () => {
      try {
        const config = await obtenerConfigCatalogo(tenantId);
        let whatsapp = config?.whatsapp ?? null;
        if (!config) {
          const { data } = await createSupabaseBrowserClient()
            .from("tenants")
            .select("telefono")
            .eq("id", tenantId)
            .maybeSingle();
          const mx = normalizarTelefonoMx(data?.telefono);
          whatsapp = mx ? `+${mx}` : null;
        }
        if (!vigente) return;
        setGuardado(config);
        setBorrador(
          config ?? {
            tenant_id: tenantId,
            activo: false,
            slug: slugInicial(tenantName, tenantId),
            whatsapp,
            mostrar_precios: true,
            mostrar_agotados: true,
            mensaje: null,
            color: null,
            portada_url: null,
          }
        );
      } catch {
        if (vigente) setError(true);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [tenantId, tenantName]);

  /** Guarda (crea o actualiza) y devuelve lo guardado. Lanza el error de la base. */
  const guardar = useCallback(async (config: CatalogoConfig) => {
    const nuevo = await guardarConfigCatalogo(config);
    setGuardado(nuevo);
    setBorrador(nuevo);
    return nuevo;
  }, []);

  return { tenantId, tenantName, guardado, borrador, cargando, error, guardar };
}
