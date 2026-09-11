"use client";

/**
 * Deja listas las paginas que deben abrirse sin conexion.
 *
 * No pinta nada. Va montado en el shell del panel para que se ejecute en
 * cualquier pantalla: el usuario puede pasar dias sin entrar al Punto de Venta
 * y aun asi debe poder abrirlo en modo avion.
 *
 * Se reintenta al volver la conexion porque ese es justo el momento en que
 * conviene refrescar lo guardado: si se cayo la red, lo que hay en cache
 * empieza a envejecer.
 */

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { warmOfflineRoutes } from "@/lib/offline/route-cache";

export function OfflineRouteWarmer() {
  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;

    const warm = (force: boolean) => {
      if (cancelled) return;
      // Errores ya tratados dentro: precalentar nunca debe romper la pantalla.
      void warmOfflineRoutes(locale, { force });
    };

    // Diferido: al arrancar compite con la carga real de la pagina, y el
    // service worker puede tardar un momento en tomar el control.
    const timeout = window.setTimeout(() => warm(false), 4000);
    const onOnline = () => warm(true);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("online", onOnline);
    };
  }, [locale]);

  return null;
}
