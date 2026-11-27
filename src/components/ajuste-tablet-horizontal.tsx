"use client";

import { useLayoutEffect } from "react";
import { aplicarViewport, viewportDeseado } from "@/lib/viewport-tablet";

/**
 * Tablet en horizontal → vista de escritorio, en el panel y en el login. Corre antes del primer
 * pintado (`useLayoutEffect`), sin `<script>`. Al desmontarse (salir del panel) vuelve el viewport normal.
 * La landing y el catálogo público no lo montan.
 */
export function AjusteTabletHorizontal() {
  useLayoutEffect(() => {
    const aplicar = () => aplicarViewport(viewportDeseado, 1024);
    aplicar();
    window.addEventListener("resize", aplicar);
    return () => {
      window.removeEventListener("resize", aplicar);
      aplicarViewport(() => "normal", 1024);
    };
  }, []);
  return null;
}
