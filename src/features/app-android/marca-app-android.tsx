"use client";

import { useEffect } from "react";
import { CLAVE_APP, cookiesViejasParaBorrar, marcarSiVieneDeApp } from "@/lib/app-android";

/**
 * Marca la pestaña cuando SYMVORA se abre desde la app de Android
 * (`lib/app-android.ts`). Va en el layout raíz (`app/layout.tsx`): cubre el
 * login, el panel y la landing. No pinta nada.
 */
export function MarcaAppAndroid() {
  useEffect(() => {
    try {
      // La primera version usaba una cookie compartida con Chrome: fuera.
      if (document.cookie.includes(`${CLAVE_APP}=`)) {
        for (const c of cookiesViejasParaBorrar(window.location.hostname)) document.cookie = c;
      }
      const yaEstaba = window.sessionStorage.getItem(CLAVE_APP) !== null;
      if (marcarSiVieneDeApp(window.sessionStorage, window.location.href, document.referrer) && !yaEstaba) {
        window.dispatchEvent(new Event("symvora:app-android"));
      }
    } catch {
      // Almacenamiento bloqueado: el cobro se muestra como en la web.
    }
  }, []);
  return null;
}
