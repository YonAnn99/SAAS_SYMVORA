import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker minimo: solo cachea estaticos.
 *
 * POR QUE SIGUE EXISTIENDO SI SE RETIRO EL MODO SIN CONEXION (2026-09-20).
 * Porque Chrome exige un service worker con manejador de `fetch` para ofrecer
 * "Instalar app", y la PWA instalable es justo lo que se decidio conservar.
 * Borrarlo no daria ningun error: simplemente dejaria de aparecer la opcion de
 * instalar, y nadie se enteraria hasta que un cliente lo reclamara.
 *
 * LO QUE YA NO HACE, Y NO DEBE VOLVER. Aqui vivian una cache propia para las
 * paginas del panel (`NetworkFirst` a 30 dias), un paso libre para el
 * precalentado de rutas y un respaldo a `/offline.html` que fingia que la app
 * funcionaba sin red. Nada de eso llego a funcionar en la PWA instalada: en
 * toda la vida del sistema no se registro ni una sola venta con
 * `origen = 'offline'`. Trabajar sin conexion se replanteara con una app
 * nativa, no volviendo a intentarlo aqui.
 *
 * `defaultCache` de serwist cubre lo que si aporta con red: fuentes, imagenes,
 * JS y CSS, para que la app cargue rapido en la segunda visita.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Desactivado a proposito: Safari soporta Navigation Preload tarde y de
  // forma inestable, y se aplica precisamente a las peticiones de navegacion.
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        // No es modo sin conexion: es la pantalla honesta que ve quien abre la
        // app instalada sin datos. Sin ella saldria el error del navegador
        // dentro de una ventana sin barra de direcciones, sin forma de saber
        // que pasa ni de reintentar.
        url: "/offline.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
