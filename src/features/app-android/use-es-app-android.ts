"use client";

import { useSyncExternalStore } from "react";
import { esPestanaDeApp } from "@/lib/app-android";

function suscribir(aviso: () => void) {
  window.addEventListener("symvora:app-android", aviso);
  return () => window.removeEventListener("symvora:app-android", aviso);
}

/** `true` dentro de la app de Android (la pestaña de la TWA). En el servidor, `false`. */
export function useEsAppAndroid(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => {
      try {
        return esPestanaDeApp(window.sessionStorage);
      } catch {
        return false;
      }
    },
    () => false
  );
}
