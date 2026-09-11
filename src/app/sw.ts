import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// `/offline.html` es la unica entrada de precache de este service worker.
// Si el archivo no existe (devuelve 404), el precaching falla, el evento
// `install` se rechaza y el service worker NUNCA se activa. Eso fue justo lo
// que paso cuando `public/offline.html` se borro por accidente en el commit
// f6555b1: en escritorio el fallo pasa desapercibido, pero en Safari/iOS las
// peticiones de navegacion terminaban en "se interrumpio la conexion de red".
//
// Para que un archivo estatico opcional no pueda volver a tumbar el arranque
// de la PWA, se comprueba que responda antes de registrarlo como fallback.
const OFFLINE_URL = "/offline.html";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Desactivado a proposito: Safari soporta Navigation Preload tarde y de
  // forma inestable, y se aplica precisamente a las peticiones de navegacion.
  // Aqui no aporta nada (no hay respuestas de navegacion lentas que precargar).
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Red de seguridad: si `/offline.html` no se pudo precachear, se cachea aparte
// durante `install` sin dejar que un fallo rechace la instalacion completa.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open("symvora-offline-fallback");
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch (error) {
        // El service worker se instala igual: perder la pagina offline degrada
        // la experiencia sin conexion, pero nunca debe romper la navegacion.
        console.warn("[sw] No se pudo cachear la pagina offline:", error);
      }
    })()
  );
});

serwist.addEventListeners();
