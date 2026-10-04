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

/** Desde `lg` (1024 px): donde aparece el menú lateral (debajo, el dock). */
const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

/**
 * `true` en escritorio, con el menú lateral visible. En el servidor (y en el
 * primer pintado) da `false`.
 */
export function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA_ESCRITORIO);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA_ESCRITORIO).matches,
    () => false
  );
}
