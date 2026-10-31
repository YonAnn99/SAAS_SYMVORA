"use client";

import { useEffect } from "react";
import { cookieAndroid, tieneCookieAndroid, vieneDeAppAndroid } from "@/lib/app-android";

/**
 * Deja la cookie de la app de Android la primera vez que SYMVORA se abre
 * desde ella (`lib/app-android.ts`). Va en el layout raíz (`app/layout.tsx`): cubre el
 * login, el panel y la landing. No pinta nada.
 */
export function MarcaAppAndroid() {
  useEffect(() => {
    try {
      if (tieneCookieAndroid(document.cookie)) return;
      if (vieneDeAppAndroid(window.location.href, document.referrer)) {
        document.cookie = cookieAndroid(window.location.hostname);
        window.dispatchEvent(new Event("symvora:app-android"));
      }
    } catch {
      // Cookies bloqueadas: el cobro se mostraria como en la web.
    }
  }, []);
  return null;
}
