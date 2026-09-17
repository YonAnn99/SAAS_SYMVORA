"use client";

/**
 * Deja listas las paginas que deben abrirse sin conexion.
 *
 * No pinta nada. Va montado en el shell del panel para que se ejecute en
 * cualquier pantalla: el usuario puede pasar dias sin entrar al Punto de Venta
 * y aun asi debe poder abrirlo en modo avion.
 *
 * POR QUE HAY VARIOS DISPARADORES: antes todo colgaba de un unico
 * `setTimeout` de 4 s que ademas exigia `navigator.serviceWorker.controller`.
 * En la primera carga tras instalar la PWA ese controlador todavia no existe,
 * y en un movil el usuario puede irse de la pantalla antes. Si esa unica
 * oportunidad se perdia, no habia otra, y el dispositivo se quedaba sin Punto
 * de Venta offline sin que nadie se enterara.
 */

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { warmOfflineRoutes } from "@/lib/offline/route-cache";

export function OfflineRouteWarmer() {
  const locale = useLocale();

  useEffect(() => {
    let cancelado = false;

    const precalentar = (trigger: string, force = false) => {
      if (cancelado) return;
      // Errores ya tratados dentro: precalentar nunca debe romper la pantalla.
      void warmOfflineRoutes(locale, { force, trigger });
    };

    // 1. Arranque. Se espera a que el service worker este listo en vez de
    //    apostar por un temporizador a ciegas.
    const alArrancar = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        return;
      }
      if (cancelado) return;
      // Diferido un poco: al arrancar compite con la carga real de la pagina.
      window.setTimeout(() => precalentar("arranque"), 2000);
    };
    void alArrancar();

    // 2. Controlador nuevo. Es el momento en que la primera instalacion
    //    empieza a controlar la pagina, y tambien cuando un despliegue trae
    //    reglas de cache nuevas y conviene repoblar.
    const alCambiarControlador = () => precalentar("controlador-nuevo", true);

    // 3. Volver a la app. En un movil este es el disparador que mas cubre: la
    //    PWA se abre y se cierra decenas de veces al dia.
    const alVolver = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        precalentar("volver-a-la-app");
      }
    };

    // 4. Vuelve la conexion. Ahora si funciona: antes, `reloadOnOnline` de
    //    serwist recargaba la pagina en este mismo evento y se lo llevaba por
    //    delante.
    const alVolverLaRed = () => precalentar("vuelve-la-red", true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        alCambiarControlador
      );
    }
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolverLaRed);

    return () => {
      cancelado = true;
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          alCambiarControlador
        );
      }
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolverLaRed);
    };
  }, [locale]);

  return null;
}
