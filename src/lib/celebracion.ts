/**
 * La "celebracion" al completar algo importante: un sonido y un destello que
 * cubre la pantalla un instante, con el mismo efecto del cambio de tema (un
 * circulo que nace del boton y se enfoca al crecer, `tema-circulo-blur` en
 * globals.css). Es solo retroalimentacion: si el navegador bloquea el audio o
 * no hay DOM, la operacion no se entera.
 *
 *   venta  verde  `sale_finish.mp3`  (confirmar venta en el POS)
 *   alta   azul   `add_item.mp3`     (crear producto o variante)
 */

export const SONIDO_VENTA = "/audio/sale/sale_finish.mp3";
export const SONIDO_ALTA = "/audio/add_item/add_item.mp3";

export const COLOR_VENTA = "#16a34a";
/** El azul de los botones de agregar (`SpecularActionButton tone="add"`). */
export const COLOR_ALTA = "#2563EB";

const audios = new Map<string, HTMLAudioElement>();

/** Deja el sonido descargado para que suene sin retraso al confirmar. */
export function precargarSonido(ruta: string): void {
  if (typeof window === "undefined" || audios.has(ruta)) return;
  const audio = new Audio(ruta);
  audio.preload = "auto";
  audios.set(ruta, audio);
}

function sonar(ruta: string): void {
  precargarSonido(ruta);
  const audio = audios.get(ruta);
  if (!audio) return;
  audio.currentTime = 0;
  // Autoplay bloqueado o archivo no disponible: se ignora.
  void audio.play().catch(() => {});
}

/**
 * `origen`: de donde nace el circulo (normalmente el boton que se confirmo).
 * Sin origen, desde el centro de la pantalla.
 */
export function celebrar({
  origen,
  color,
  sonido,
}: {
  origen?: DOMRect | null;
  color: string;
  sonido: string;
}): void {
  if (typeof document === "undefined") return;
  sonar(sonido);

  const destello = document.createElement("div");
  destello.className = "destello-venta";
  destello.setAttribute("aria-hidden", "true");
  destello.style.setProperty("--destello-color", color);
  const x = origen ? Math.round(origen.left + origen.width / 2) : null;
  const y = origen ? Math.round(origen.top + origen.height / 2) : null;
  destello.style.setProperty(
    "--tema-origen",
    x !== null && y !== null ? `${x}px ${y}px` : "50% 50%"
  );

  // Se quita al terminar la ultima animacion (el desvanecido). El tope de
  // tiempo cubre el caso de que el navegador no emita el evento.
  const quitar = () => destello.remove();
  destello.addEventListener("animationend", (e) => {
    if (e.animationName === "destello-venta-salida") quitar();
  });
  window.setTimeout(quitar, 2000);

  document.body.appendChild(destello);
}

/** Alta de producto o variante: azul SYMVORA y su sonido. */
export function celebrarAlta(origen?: DOMRect | null): void {
  celebrar({ origen, color: COLOR_ALTA, sonido: SONIDO_ALTA });
}
