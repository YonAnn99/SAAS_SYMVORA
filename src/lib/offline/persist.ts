"use client";

/**
 * Durabilidad del almacenamiento local y detección de PWA instalada.
 *
 * El problema real: en iOS, Safari puede **desalojar IndexedDB** tras ~7 días
 * sin usar el sitio, y en una pestaña normal (no instalada) las garantías son
 * bastante peores que en una PWA añadida a la pantalla de inicio. Como la cola
 * guarda ventas ya cobradas, eso no es una molestia: es pérdida de dinero.
 *
 * Estas dos funciones son mitigación, **no garantía**. La red de seguridad de
 * verdad es el banner de ventas pendientes: mientras alguien lo vea, sabe que
 * no puede cerrar el día todavía.
 */

/**
 * Pide al navegador que no desaloje los datos de este origen.
 *
 * Devuelve `true` solo si el almacenamiento quedó marcado como persistente.
 * Safari puede denegarlo sin dar motivo, así que el llamador debe tratar el
 * `false` como "hay riesgo", nunca como un error que deba abortar nada.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    // Si ya estaba concedido, no volver a pedirlo: en algunos navegadores
    // repetir la petición muestra un prompt al usuario.
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** ¿La app corre como PWA instalada (pantalla de inicio) y no como pestaña? */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosStandalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS se presenta como Mac; se distingue por tener pantalla táctil.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * ¿Hay que avisar de que conviene instalar la app antes de vender sin red?
 *
 * Solo en iOS y solo fuera de la PWA instalada: es el único escenario donde el
 * riesgo de que el sistema borre la cola es alto de verdad.
 */
export function shouldWarnAboutIosInstall(): boolean {
  return isIos() && !isStandalonePwa();
}
