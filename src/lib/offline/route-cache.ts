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
 * QUE CAMBIO Y POR QUE (tras el fallo reportado en Android):
 *
 * 1. **El cliente escribe la cache el mismo.** Antes se confiaba en que la
 *    estrategia `NetworkFirst` del service worker guardara el `fetch`. Eso
 *    ocurre dentro de un `waitUntil` que puede resolverse DESPUES de que el
 *    `fetch` devuelva, asi que no habia forma de verificarlo sin carreras. Y si
 *    `cacheWillUpdate` rechazaba la respuesta, el fallo era invisible.
 * 2. **Se verifica leyendo.** Escribir no basta: se vuelve a leer la entrada.
 * 3. **El candado mira la CACHE, no el reloj.** Antes `shouldWarm()` bloqueaba
 *    el reintento seis horas aunque la cache estuviera vacia. Ese es
 *    exactamente el estado que dejaba la PWA inservible: una vez perdida la
 *    cache, no se reintentaba. Ahora una ruta AUSENTE se precalienta siempre.
 */

import type { WarmReport, ResultadoRuta } from "./diagnostics";
import { guardarInforme, informeTieneFallos } from "./diagnostics";

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

/**
 * Cabecera que marca la peticion de precalentado.
 *
 * El service worker la deja pasar sin cachear (`NetworkOnly`): si la guardara
 * la estrategia, tendriamos dos escritores para la misma entrada y volveriamos
 * al problema de no poder verificar nada.
 */
export const CABECERA_PRECALENTADO = "X-Symvora-Warm";

const LAST_WARM_KEY = "symvora_offline_warm_at";
const REINTENTO_TRAS_EXITO_MS = 6 * 60 * 60 * 1000;
/** Tras un fallo se reintenta pronto: puede haber sido un corte de un minuto. */
const REINTENTO_TRAS_FALLO_MS = 5 * 60 * 1000;

interface MarcaPrecalentado {
  at: number;
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Logica pura (con test)
// ---------------------------------------------------------------------------

/** Las rutas de este idioma, en el orden en que se piden. */
export function rutasAPrecalentar(locale: string): string[] {
  return OFFLINE_ROUTES.map((ruta) => `/${locale}${ruta}`);
}

/**
 * Cuales hay que pedir ahora mismo.
 *
 * La regla clave: **una ruta que NO esta en cache se pide siempre**, pase lo
 * que pase con el candado. Sin esto, un dispositivo que perdio la cache se
 * quedaba seis horas sin Punto de Venta y, como cada arranque renovaba el
 * bloqueo, en la practica para siempre.
 */
export function rutasPorPrecalentar(
  locale: string,
  presentes: ReadonlySet<string>,
  marca: MarcaPrecalentado | null,
  ahora: number,
  force = false
): string[] {
  const todas = rutasAPrecalentar(locale);
  if (force) return todas;

  const espera = marca?.ok ? REINTENTO_TRAS_EXITO_MS : REINTENTO_TRAS_FALLO_MS;
  const candadoVigente = marca !== null && ahora - marca.at < espera;

  return todas.filter((ruta) => {
    if (!presentes.has(ruta)) return true; // ausente: siempre
    return !candadoVigente; // presente: solo para refrescar
  });
}

export interface RespuestaResumida {
  ok: boolean;
  status: number;
  redirected: boolean;
  /** URL final, ya seguidos los redirects. */
  url: string;
}

/**
 * ¿Esta respuesta se puede guardar como la pagina pedida?
 *
 * Con la sesion caducada el servidor devuelve un 307 a /login y `fetch` lo
 * SIGUE, asi que llega un 200 perfectamente valido... con el HTML del login
 * dentro. Guardarlo bajo la URL del panel seria peor que no guardar nada: sin
 * conexion apareceria una pantalla de inicio de sesion que encima no puede
 * validar nada.
 */
export function esRespuestaUtilizable(
  path: string,
  respuesta: RespuestaResumida,
  origin: string
): ResultadoRuta {
  if (!respuesta.ok || respuesta.status !== 200) return "http-error";
  if (respuesta.redirected) return "redirigida";
  let pathFinal: string;
  try {
    pathFinal = new URL(respuesta.url, origin).pathname;
  } catch {
    return "http-error";
  }
  // Se comprueban las dos señales porque `redirected` no siempre sobrevive al
  // paso por el service worker; la URL final si. Y cubre el caso raro de que
  // el fallback devuelva `/offline.html` con un 200.
  if (pathFinal !== path) return "redirigida";
  return "guardada";
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

/**
 * Manda el fallo a Sentry.
 *
 * Es lo que convierte un fallo mudo en algo que se ve sin tener el telefono
 * delante. Se importa de forma perezosa para no cargar el SDK en dispositivos
 * donde todo va bien.
 */
async function avisarSiFalla(informe: WarmReport): Promise<void> {
  if (!informeTieneFallos(informe)) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage("[offline] precalentado incompleto", {
      level: "warning",
      extra: { informe },
    });
  } catch {
    // Sin Sentry el informe sigue guardado en el dispositivo.
  }
}

function leerMarca(): MarcaPrecalentado | null {
  try {
    const crudo = window.localStorage.getItem(LAST_WARM_KEY);
    if (!crudo) return null;
    // Retrocompatibilidad: la version anterior guardaba un numero suelto.
    const n = Number(crudo);
    if (Number.isFinite(n) && n > 0) return { at: n, ok: true };
    const datos = JSON.parse(crudo) as MarcaPrecalentado;
    return typeof datos?.at === "number" ? datos : null;
  } catch {
    return null;
  }
}

function escribirMarca(ok: boolean): void {
  try {
    window.localStorage.setItem(
      LAST_WARM_KEY,
      JSON.stringify({ at: Date.now(), ok })
    );
  } catch {
    // Sin localStorage se precalienta siempre: preferible gastar unas
    // peticiones a quedarse sin Punto de Venta.
  }
}

/** Olvida el candado. Se llama al entrar, para preparar el dispositivo ya. */
export function reiniciarCandadoPrecalentado(): void {
  try {
    window.localStorage.removeItem(LAST_WARM_KEY);
  } catch {
    // Da igual.
  }
}

/** Que rutas del idioma estan hoy guardadas. */
export async function rutasEnCache(locale: string): Promise<Set<string>> {
  const presentes = new Set<string>();
  if (typeof caches === "undefined") return presentes;
  try {
    const cache = await caches.open(APP_PAGES_CACHE);
    for (const ruta of rutasAPrecalentar(locale)) {
      if (await cache.match(ruta)) presentes.add(ruta);
    }
  } catch {
    // Sin acceso a las caches se devuelve vacio: se intentara precalentar.
  }
  return presentes;
}

/**
 * Pide el HTML de las rutas offline y lo guarda, comprobando que quedo.
 *
 * Las peticiones van en serie para no competir con lo que el usuario esta
 * haciendo en pantalla.
 */
export async function warmOfflineRoutes(
  locale: string,
  {
    force = false,
    trigger = "desconocido",
  }: { force?: boolean; trigger?: string } = {}
): Promise<WarmReport | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    const informe: WarmReport = {
      at: new Date().toISOString(),
      locale,
      trigger,
      rutas: [],
      nota: "sin-controlador",
    };
    guardarInforme(informe);
    void avisarSiFalla(informe);
    return null;
  }
  if (typeof caches === "undefined") return null;
  if (!navigator.onLine) return null;

  const presentes = await rutasEnCache(locale);
  const pendientes = rutasPorPrecalentar(
    locale,
    presentes,
    leerMarca(),
    Date.now(),
    force
  );
  if (pendientes.length === 0) return null;

  const cache = await caches.open(APP_PAGES_CACHE);
  const rutas: WarmReport["rutas"] = [];

  for (const path of pendientes) {
    let resultado: ResultadoRuta = "sin-red";
    let status: number | undefined;
    let pathFinal: string | undefined;

    try {
      // `same-origin` es obligatorio: sin las cookies de sesion el servidor
      // responde con un redirect a /login.
      const respuesta = await fetch(path, {
        credentials: "same-origin",
        headers: { [CABECERA_PRECALENTADO]: "1" },
      });
      status = respuesta.status;
      pathFinal = new URL(respuesta.url, location.origin).pathname;

      resultado = esRespuestaUtilizable(
        path,
        {
          ok: respuesta.ok,
          status: respuesta.status,
          redirected: respuesta.redirected,
          url: respuesta.url,
        },
        location.origin
      );

      if (resultado === "guardada") {
        // Se reescribe la respuesta SIN `Vary`. Vercel responde con
        // `Vary: rsc, next-router-state-tree, ...`, y aunque hoy casa bien, una
        // cabecera de mas el dia de mañana haria que la entrada guardada no se
        // encontrara nunca. Una respuesta sin `Vary` casa con cualquier
        // peticion posterior.
        const cuerpo = await respuesta.blob();
        const cabeceras = new Headers(respuesta.headers);
        cabeceras.delete("Vary");
        cabeceras.delete("Cache-Control");
        await cache.put(
          path,
          new Response(cuerpo, { status: 200, headers: cabeceras })
        );

        // Verificar leyendo: escribir sin comprobar es como estaba antes, y
        // por eso el fallo era invisible.
        if (!(await cache.match(path))) resultado = "no-verificada";
      }
    } catch {
      resultado = "sin-red";
    }

    // `continue`, no `return`: antes, un 307 en /dashboard impedia que /pos se
    // intentara siquiera, y /dashboard es la primera de la lista.
    rutas.push({ path, resultado, status, pathFinal });
  }

  const todasBien = rutas.every((r) => r.resultado === "guardada");
  escribirMarca(todasBien);

  const informe: WarmReport = {
    at: new Date().toISOString(),
    locale,
    trigger,
    rutas,
  };
  guardarInforme(informe);
  void avisarSiFalla(informe);
  return informe;
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
    reiniciarCandadoPrecalentado();
  } catch {
    // Nunca debe impedir cerrar sesion.
  }
}
