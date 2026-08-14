"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const DEMO_EMAIL = "demo@symvora.com";

/**
 * Devuelve true si el cliente actual está en modo demo.
 *
 * Combina tres fuentes:
 *   1. sessionStorage["demo_active"] === "1" — fijada por /[locale]/demo/page.tsx
 *      al verificar el magic link.
 *   2. searchParams.get("demo") === "1" — fijada por la redirección
 *      hard-navigate a /[locale]/dashboard?demo=1.
 *   3. user.email === "demo@symvora.com" — fuente definitiva, funciona
 *      aunque el usuario haya navegado fuera del dashboard.
 *
 * La fuente #3 puede ser asíncrona porque requiere un getUser() extra;
 * mientras carga, devuelve el valor combinado de #1 y #2 (que es
 * suficiente para ocultar UI inmediatamente después de aterrizar en
 * el dashboard).
 */
export function useIsDemo(): boolean {
  const searchParams = useSearchParams();
  const isDemoFromQuery = searchParams?.get("demo") === "1";

  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("demo_active") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Refresca cuando cambia el query param (navegación interna)
    if (isDemoFromQuery) {
      try {
        sessionStorage.setItem("demo_active", "1");
      } catch {
        // ignore
      }
      setIsDemo(true);
    }

    // Comprobación definitiva vía sesión de Supabase
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setIsDemo(false);
          return;
        }
        const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
        const demo = user.email === DEMO_EMAIL || appMeta.is_demo === true;
        setIsDemo(demo);
        if (!demo) {
          try {
            sessionStorage.removeItem("demo_active");
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isDemoFromQuery]);

  return isDemoFromQuery || isDemo;
}
