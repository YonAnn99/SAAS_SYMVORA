"use client";

import { useSyncExternalStore } from "react";
import {
  hayEventoInstalacion,
  pedirInstalacion,
  seInstaloAhora,
  suscribirInstalacion,
} from "./captura-instalacion";

function abiertaComoApp(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: window-controls-overlay)").matches ||
      // Safari en iPhone
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * - `puedeInstalar`: el navegador ofrece instalar (Chrome/Edge) y aun no se uso.
 * - `instalada`: esta pagina ya corre como app, o se acaba de instalar.
 * - `instalar()`: abre el dialogo del navegador; `true` si se acepto.
 */
export function useInstalarApp() {
  const puedeInstalar = useSyncExternalStore(suscribirInstalacion, hayEventoInstalacion, () => false);
  const instalada = useSyncExternalStore(
    suscribirInstalacion,
    () => seInstaloAhora() || abiertaComoApp(),
    () => false
  );
  return { puedeInstalar, instalada, instalar: pedirInstalacion };
}
