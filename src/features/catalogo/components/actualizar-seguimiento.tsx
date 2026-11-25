"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la página de seguimiento cada 30 s mientras el pedido siga en curso, y al regresar a la pestaña
 * (máx. una vez cada 10 s). Solo `router.refresh()`: no guarda nada en el navegador.
 */
export function ActualizarSeguimiento({ activo }: { activo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!activo) return;
    let ultimo = Date.now();
    const refrescar = () => {
      ultimo = Date.now();
      router.refresh();
    };
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, 30_000);
    const alVolver = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimo > 10_000) refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, router]);
  return null;
}
