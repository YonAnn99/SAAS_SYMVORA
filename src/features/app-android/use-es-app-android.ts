"use client";

import { useSyncExternalStore } from "react";
import { tieneCookieAndroid } from "@/lib/app-android";

function suscribir(aviso: () => void) {
  window.addEventListener("symvora:app-android", aviso);
  return () => window.removeEventListener("symvora:app-android", aviso);
}

/** `true` dentro de la app de Android. En el servidor, `false`. */
export function useEsAppAndroid(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => {
      try {
        return tieneCookieAndroid(document.cookie);
      } catch {
        return false;
      }
    },
    () => false
  );
}
