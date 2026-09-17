import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import {
  APP_PAGES_CACHE,
  APP_PAGE_PATH,
  CABECERA_PRECALENTADO,
} from "@/lib/offline/route-cache";

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

// Paginas del panel que tienen que abrirse sin conexion.
//
// `defaultCache` las manda al cubo generico `others`: caduca a las 24 h y
// comparte 32 huecos con todo lo demas, asi que el Punto de Venta se perdia
// solo. Aqui tienen cache propia, 30 dias y huecos que nadie mas usa.
//
// El matcher va por RUTA, no por `request.mode === "navigate"`, a proposito:
// el precalentado de `warmOfflineRoutes()` usa un `fetch()` normal, que no es
// una navegacion. Si se filtrara por modo, lo precalentado caeria en otra
// cache y la navegacion posterior no lo encontraria.

// El precalentado del cliente NO lo cachea ninguna estrategia.
//
// El cliente escribe la entrada el mismo con `cache.put` para poder verificarla
// despues. Si ademas la guardara `NetworkFirst`, habria dos escritores para la
// misma URL y volveriamos a no poder comprobar nada: el `cache.put` de la
// estrategia ocurre dentro de un `waitUntil` que puede resolverse despues de
// que el `fetch` devuelva.
//
// OJO: `NetworkOnly` tambien recibe el plugin de respaldo de serwist, asi que
// sin red devolvera `/offline.html` con un 200. Es contraintuitivo, pero el
// cliente lo detecta comparando el `pathname` final.
const warmPassthrough = {
  matcher: ({ request }: { request: Request }) =>
    request.headers.get(CABECERA_PRECALENTADO) === "1",
  handler: new NetworkOnly(),
};

const appPagesCaching = {
  matcher: ({
    request,
    url,
    sameOrigin,
  }: {
    request: Request;
    url: URL;
    sameOrigin: boolean;
  }) =>
    sameOrigin &&
    request.headers.get(CABECERA_PRECALENTADO) !== "1" &&
    // Los payloads RSC ya tienen su propia cache en `defaultCache`; meterlos
    // aqui guardaria dos cosas distintas bajo la misma URL.
    request.headers.get("RSC") !== "1" &&
    APP_PAGE_PATH.test(url.pathname),
  handler: new NetworkFirst({
    cacheName: APP_PAGES_CACHE,
    // Con datos moviles malos `navigator.onLine` dice que hay red y la
    // peticion se queda colgada hasta que expira el TCP. Tres segundos y se
    // sirve lo guardado: en una caja registradora esperar es peor que servir
    // una version de hace un rato.
    networkTimeoutSeconds: 3,
    // Una entrada guardada por el cliente no lleva `Vary`, pero las que
    // guarde la propia estrategia si. Cuesta nada y cubre el dia que la
    // plataforma añada una cabecera nueva al `Vary` y deje de casar.
    matchOptions: { ignoreVary: true },
    plugins: [
      {
        // Nunca guardar bajo la URL del panel algo que no sea el panel.
        //
        // Con la sesion caducada el servidor responde 307 hacia /login y el
        // `fetch` interno lo SIGUE, asi que lo que llega aqui es un 200
        // perfectamente valido con el HTML del login dentro. Sin este filtro
        // quedaria guardado como si fuera el dashboard, y sin conexion
        // apareceria una pantalla de inicio de sesion incapaz de validar nada
        // (peor que la pagina de "sin conexion", que al menos lo explica).
        //
        // Va aparte del filtro que ya hace el cliente en `warmOfflineRoutes`:
        // esta regla tambien cubre las navegaciones normales del usuario.
        cacheWillUpdate: async ({ response }: { response: Response }) =>
          response.status === 200 && !response.redirected ? response : null,
      },
      new ExpirationPlugin({
        maxEntries: 16,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Desactivado a proposito: Safari soporta Navigation Preload tarde y de
  // forma inestable, y se aplica precisamente a las peticiones de navegacion.
  // Aqui no aporta nada (no hay respuestas de navegacion lentas que precargar).
  navigationPreload: false,
  // Delante de `defaultCache`: la primera regla que coincide gana.
  // El paso libre del precalentado va PRIMERO: la primera regla gana.
  runtimeCaching: [warmPassthrough, appPagesCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Nota: aqui habia un handler de `install` que cacheaba `/offline.html` en una
// cache aparte (`symvora-offline-fallback`) como red de seguridad. Era codigo
// muerto: `PrecacheFallbackPlugin` de serwist solo hace `matchPrecache()`, asi
// que nunca miraba esa cache. Se retira para no dar falsa sensacion de respaldo.
//
// Tampoco se puede instrumentar `appPagesCaching` con un plugin que tenga
// `handlerDidError`: serwist solo inyecta el respaldo de `/offline.html` en las
// estrategias que NO tengan ya ese callback, asi que añadirlo dejaria las
// paginas del panel sin pagina de respaldo.

serwist.addEventListeners();
