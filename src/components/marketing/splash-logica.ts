/**
 * Splash de la landing (`splash-entrada.tsx`): logica pura y tiempos (`splash-control.tsx` y el test la usan).
 *
 * Tiempos a partir de lo medido el 2026-11-05 en produccion:
 * - `/es` pesa ~400 KB comprimidos (305 KB de JS).
 * - En escritorio: FCP 0.9 s, LCP 1.4 s y `load` 2.4 s. El freno es la hidratacion, no la descarga.
 * - En un celular con 4G lento queda lista hacia los 3-5 s.
 *
 * Por eso, contando desde la ANIMACION misma (no desde un reloj):
 * - la entrada (~2.25 s) se ve completa siempre: la salida espera a que terminen sus
 *   animaciones, aunque el navegador pinte tarde;
 * - el logo y la palabra completos se quedan una pausa para apreciarlos;
 * - si la pagina aun no termina (`load` + fuentes), respiran hasta que termine, con tope;
 * - total tipico ≈ 4 s (2.25 + 0.6 + 1.1); con carga lenta, hasta ≈ 6 s.
 *
 * Antes se contaba desde que el parser leia el script en linea. Las animaciones CSS
 * arrancan despues, en el primer calculo de estilo, y en algunos navegadores eso tarda:
 * la salida llegaba con la entrada a medias y el splash pasaba sin verse.
 */

/** Pausa con el logo y la palabra ya completos antes de volar al header. */
export const PAUSA_MS = 600;
/** Cuanto mas, despues de la pausa, se espera a que la pagina termine de cargar. */
export const ESPERA_MAX_MS = 2000;
/** Vuelo del logo y la palabra al header; al terminar aparece el logo real. */
export const ATERRIZAJE_MS = 800;
/** Salida completa (vuelo + vidrio que se disuelve); despues se oculta el splash. */
export const SALIDA_MS = 1100;
/** Si las animaciones nunca avisan que terminaron, la salida se fuerza a este tiempo del montaje. */
export const SALIDA_FORZADA_MS = 7000;
/** Si el JS de la pagina nunca llega, una animacion CSS retira el splash aqui (`splash-entrada.css`). */
export const RESPALDO_MS = 8000;
/** Marca de "ya se vio en esta sesion". Debe coincidir con el literal de `decidirSplash`. */
export const CLAVE_SESION = "symvora-splash";

/**
 * Logo de la pildora del menu movil (`BubbleMenu`, que carga sin SSR) cuando aun no
 * existe: 24 px de borde, pildora de 132x40 y logo de 28 px centrado.
 */
export const LOGO_MOVIL_RESPALDO: Caja = { left: 76, top: 34, width: 28, height: 28 };

export interface EntornoSplash {
  document: { documentElement: { classList: { add(clase: string): void } }; referrer?: string };
  sessionStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  matchMedia?: (consulta: string) => { matches: boolean };
  navigator?: { userAgent?: string; webdriver?: boolean; standalone?: boolean };
  location?: { search: string };
}

/** Donde se monta el splash: la landing (vuela al header) o la app instalada (PWA / APK). */
export type VarianteSplash = "landing" | "app";

/**
 * Decide, antes del primer pintado, si se muestra el splash. Pone en `<html>` la clase
 * `splash-activo` o `sin-splash`.
 *
 * Se SERIALIZA con `toString()` al `<script>` en linea del splash, asi que no puede usar
 * nada de fuera de su cuerpo: ni imports ni constantes de este modulo. Por eso las claves van
 * escritas a mano; el test comprueba que coincidan con `CLAVE_SESION` y `lib/app-android.ts`.
 *
 * No se muestra:
 * - a bots, Lighthouse ni navegadores automatizados (SEO y captura de Google);
 * - con `prefers-reduced-motion`;
 * - en modo "app", si no corre como PWA instalada (`display-mode` standalone, ventana o
 *   pantalla completa; `navigator.standalone` en iOS);
 * - en modo "app", NUNCA en la app de Play (TWA), aunque tambien sea standalone: ahi va
 *   solo el splash nativo con el logo (decision del 2026-11-05; con los dos se veian dos
 *   splash seguidos). Marcas de la TWA: `?app=android`, referrer `android-app://` (se
 *   conserva tras la redireccion al login) o la marca `symvora_app` de la pestaña;
 * - si ya se vio en la sesion. Cada arranque de la app es una sesion nueva: sale una vez
 *   por arranque.
 */
export function decidirSplash(entorno?: EntornoSplash, modo?: VarianteSplash): boolean {
  const w = (entorno || window) as EntornoSplash;
  let mostrar = true;
  const nav = w.navigator || {};
  if (nav.webdriver || /bot|crawl|spider|slurp|lighthouse|pagespeed|headless/i.test(nav.userAgent || "")) {
    mostrar = false;
  }
  if (mostrar && w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mostrar = false;
  }
  if (mostrar && modo === "app") {
    let instalada = nav.standalone === true;
    const mm = w.matchMedia;
    if (mm) {
      instalada =
        instalada ||
        mm("(display-mode: standalone)").matches ||
        mm("(display-mode: window-controls-overlay)").matches ||
        mm("(display-mode: fullscreen)").matches;
    }
    let enTwa =
      /[?&]app=android(&|$)/.test((w.location && w.location.search) || "") ||
      (w.document.referrer || "").indexOf("android-app://") === 0;
    try {
      if (w.sessionStorage && w.sessionStorage.getItem("symvora_app") === "android") enTwa = true;
    } catch {
      // sin sessionStorage: se decide por lo demas.
    }
    if (!instalada || enTwa) mostrar = false;
  }
  if (mostrar) {
    try {
      if (w.sessionStorage && w.sessionStorage.getItem("symvora-splash")) mostrar = false;
      else if (w.sessionStorage) w.sessionStorage.setItem("symvora-splash", "1");
    } catch {
      // sessionStorage bloqueado (modo privado estricto): se muestra igual.
    }
  }
  w.document.documentElement.classList.add(mostrar ? "splash-activo" : "sin-splash");
  return mostrar;
}

/**
 * Instante (en el reloj de `performance.now()`) en que empieza la salida.
 * - `finEntrada`: cuando terminaron las animaciones de entrada.
 * - `cargadaEn`: cuando la pagina termino de cargar, o `null` si aun no.
 *
 * Siempre hay pausa tras la entrada. Si la carga llega despues, se espera a ella, pero
 * nunca mas de `ESPERA_MAX_MS`.
 */
export function instanteDeSalida(finEntrada: number, cargadaEn: number | null): number {
  const trasPausa = finEntrada + PAUSA_MS;
  const tope = trasPausa + ESPERA_MAX_MS;
  if (cargadaEn === null) return tope;
  return Math.min(Math.max(trasPausa, cargadaEn), tope);
}

export interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Vuelo {
  dx: number;
  dy: number;
  s: number;
}

/**
 * Traslado y escala para llevar `origen` a `destino` (FLIP), de centro a centro. La escala
 * sale de las alturas, salvo que se pase otra (la palabra usa la razon de tamanos de fuente).
 */
export function vectorDeVuelo(origen: Caja, destino: Caja, escala?: number): Vuelo {
  const centroX = (c: Caja) => c.left + c.width / 2;
  const centroY = (c: Caja) => c.top + c.height / 2;
  return {
    dx: centroX(destino) - centroX(origen),
    dy: centroY(destino) - centroY(origen),
    s: escala ?? (origen.height > 0 ? destino.height / origen.height : 1),
  };
}
