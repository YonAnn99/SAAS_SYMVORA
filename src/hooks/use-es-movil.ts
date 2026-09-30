"use client";

import { useSyncExternalStore } from "react";

/** Por debajo de `sm` (640 px): el mismo corte que usan los estilos. */
const CONSULTA = "(max-width: 639px)";

/**
 * `true` en pantallas de celular. En el servidor (y en el primer pintado) da
 * `false`: lo que depende de esto debe verse bien en ambos casos.
 */
export function useEsMovil(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA).matches,
    () => false
  );
}
