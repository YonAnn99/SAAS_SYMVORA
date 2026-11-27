/**
 * Tablet en horizontal = vista de escritorio.
 *
 * El panel pasa a escritorio desde 1024 px de ANCHO CSS (`lg`). Una tablet táctil de 8–10" en horizontal
 * puede medir 800–960 px y se quedaba con la vista de celular. Aquí se decide si el `viewport` debe fingir
 * 1024 px: el navegador escala la página para que quepa y todo el panel ve escritorio sin tocar componentes.
 *
 * IMPORTANTE: `viewportDeseado` y `aplicarViewport` se SERIALIZAN (`toString()`) para el script en línea, así
 * que no pueden usar nada de fuera de su cuerpo: ni constantes, ni imports, ni funciones de este archivo.
 */

export type ModoViewport = "escritorio" | "normal";

export interface EntradaViewport {
  /** Pantalla táctil (`pointer: coarse` o puntos de contacto). */
  tactil: boolean;
  /** Lado corto de la pantalla en px CSS (`min(screen.width, screen.height)`). */
  ladoCorto: number;
  /** Lado largo de la pantalla en px CSS. */
  ladoLargo: number;
  /** Orientación horizontal. */
  horizontal: boolean;
}

/**
 * Escritorio solo si es una tablet (táctil, lado corto ≥ 600 px) en horizontal y el lado largo no llega al
 * ancho de escritorio. Un celular en horizontal mide ≤ ~430 px de lado corto: nunca entra. Una tablet que ya
 * llega a 1024 px (iPad, tablets grandes) tampoco, porque no hace falta escalar.
 */
export function viewportDeseado(e: EntradaViewport, ancho = 1024, ladoMinimo = 600): ModoViewport {
  if (e.tactil && e.horizontal && e.ladoCorto >= ladoMinimo && e.ladoLargo < ancho) {
    return "escritorio";
  }
  return "normal";
}

/**
 * Aplica el viewport según la pantalla actual. Lee `screen` (no `innerWidth`), así cambiar el viewport no
 * vuelve a disparar la decisión en un ciclo. Guarda el contenido original del meta para restaurarlo al
 * volver a vertical.
 */
export function aplicarViewport(decidir: (e: EntradaViewport, ancho: number) => ModoViewport, ancho: number) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (!meta.getAttribute("data-original")) {
    meta.setAttribute("data-original", meta.getAttribute("content") || "");
  }
  const original = meta.getAttribute("data-original") || "";
  const ladoCorto = Math.min(screen.width, screen.height);
  const ladoLargo = Math.max(screen.width, screen.height);
  const tactil = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia("(pointer: coarse)").matches;
  const horizontal = window.matchMedia("(orientation: landscape)").matches;
  const modo = decidir({ tactil, ladoCorto, ladoLargo, horizontal }, ancho);
  const nuevo = modo === "escritorio" ? "width=" + ancho + ", initial-scale=1, maximum-scale=5" : original;
  if (meta.getAttribute("content") !== nuevo) meta.setAttribute("content", nuevo);
}
