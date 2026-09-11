/**
 * Precalentado de las paginas que deben abrirse SIN conexion.
 *
 * El problema que resuelve: a las rutas del panel solo se llega por navegacion
 * de cliente (`router.push`), asi que el navegador nunca pide su HTML y el
 * service worker nunca lo guarda. Al abrir la PWA en modo avion, la peticion de
 * navegacion no encuentra nada en cache y termina en `/offline.html`, un
 * callejon sin salida: el Punto de Venta funciona entero en el cliente, pero no
 * hay forma de llegar a el.
 *
 * La solucion es pedir ese HTML a proposito mientras SI hay red. Un `fetch()`
 * normal pasa por el service worker igual que una navegacion y se guarda bajo
 * la misma URL, asi que una navegacion posterior lo encuentra. Verificado: una
 * pagina guardada asi se sirve en un arranque en frio sin red.
 */

/** Rutas (sin locale) que deben sobrevivir a un arranque sin conexion. */
export const OFFLINE_ROUTES = ["/dashboard", "/pos"] as const;

/**
 * Que rutas guarda el service worker en `APP_PAGES_CACHE`.
 *
 * Vive aqui, junto a `OFFLINE_ROUTES`, porque las dos listas TIENEN que decir
 * lo mismo: si el cliente precalienta una ruta que el service worker manda a
 * otra cache, lo precalentado no se usa nunca y el fallo es invisible hasta
 * que alguien se queda sin conexion. Al derivarse de la misma constante no
 * pueden divergir.
 *
 * `sw.ts` la importa: el modulo no toca `window` en el nivel superior, asi que
 * se puede empaquetar tambien dentro del worker.
 */
export const APP_PAGE_PATH = new RegExp(
  `^/[a-z]{2}(${OFFLINE_ROUTES.join("|")})(/|$)`
);

/**
 * Cache propia, separada de la de serwist. La de serwist (`others`) caduca a
 * las 24 h y comparte 32 huecos con todo lo demas: un fin de semana sin abrir
 * la app bastaba para perder el Punto de Venta.
 */
export const APP_PAGES_CACHE = "symvora-app-pages";

/** No repetir el precalentado en cada carga: gasta datos sin ganar nada. */
const LAST_WARM_KEY = "symvora_offline_warm_at";
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;

function shouldWarm(): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_WARM_KEY) ?? 0);
    return !Number.isFinite(last) || Date.now() - last > WARM_EVERY_MS;
  } catch {
    // Sin localStorage (modo privado) se precalienta siempre: es preferible
    // gastar unas peticiones a quedarse sin Punto de Venta.
    return true;
  }
}

function markWarmed(): void {
  try {
    window.localStorage.setItem(LAST_WARM_KEY, String(Date.now()));
  } catch {
    // Da igual: lo peor que pasa es que se precaliente de nuevo.
  }
}

/**
 * Pide el HTML de las rutas offline para que queden en cache.
 *
 * Solo hace algo si hay un service worker controlando la pagina: sin el, el
 * `fetch` gasta datos y no guarda nada. Las peticiones van en serie para no
 * competir con lo que el usuario esta haciendo en pantalla.
 */
export async function warmOfflineRoutes(
  locale: string,
  { force = false }: { force?: boolean } = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
  if (!navigator.onLine) return;
  if (!force && !shouldWarm()) return;

  for (const route of OFFLINE_ROUTES) {
    const path = `/${locale}${route}`;
    try {
      // `same-origin` es obligatorio: sin las cookies de sesion el servidor
      // responde con un redirect a /login.
      const response = await fetch(path, { credentials: "same-origin" });

      // Con la sesion caducada el servidor devuelve un 307 a /login y `fetch`
      // lo SIGUE, asi que llega un 200 perfectamente valido... con el HTML del
      // login dentro. Guardarlo bajo la URL del panel seria peor que no
      // guardar nada: sin conexion apareceria una pantalla de inicio de sesion
      // que encima no puede validar nada. Se comprueban las dos senales
      // porque `redirected` no siempre sobrevive al paso por el service
      // worker; la URL final si.
      if (!response.ok) return;
      if (response.redirected) return;
      if (new URL(response.url, location.origin).pathname !== path) return;
    } catch {
      // Se corto la red a mitad. Lo ya guardado sigue sirviendo.
      return;
    }
  }

  // Solo si TODAS se guardaron: marcarlo antes dejaria el dispositivo sin
  // Punto de Venta y sin reintento durante las proximas seis horas.
  markWarmed();
}

/**
 * Borra las paginas guardadas del panel.
 *
 * Se llama al cerrar sesion: el HTML cacheado del dashboard trae los datos del
 * usuario que lo genero. En un mostrador compartido, sin esto el siguiente
 * cajero podria ver sin conexion el panel del anterior.
 */
export async function clearAppPagesCache(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    await caches.delete(APP_PAGES_CACHE);
    window.localStorage.removeItem(LAST_WARM_KEY);
  } catch {
    // Nunca debe impedir cerrar sesion.
  }
}
