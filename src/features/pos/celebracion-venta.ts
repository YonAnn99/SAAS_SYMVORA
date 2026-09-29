/**
 * La "celebracion" al confirmar una venta: un sonido y un destello verde que
 * cubre la pantalla un instante, con el mismo efecto del cambio de tema (un
 * circulo que nace del boton y se enfoca al crecer, `tema-circulo-blur` en
 * globals.css). Es solo retroalimentacion para quien cobra: si el navegador
 * bloquea el audio o no hay DOM, la venta no se entera.
 */

const SONIDO_VENTA = "/audio/sale/sale_finish.mp3";

let audio: HTMLAudioElement | null = null;

/** Deja el sonido descargado para que suene sin retraso al confirmar. */
export function precargarSonidoVenta(): void {
  if (typeof window === "undefined" || audio) return;
  audio = new Audio(SONIDO_VENTA);
  audio.preload = "auto";
}

function sonar(): void {
  precargarSonidoVenta();
  if (!audio) return;
  audio.currentTime = 0;
  // Autoplay bloqueado o archivo no disponible: se ignora.
  void audio.play().catch(() => {});
}

/**
 * `origen`: de donde nace el circulo verde (normalmente el boton de cobrar).
 * Sin origen, desde el centro de la pantalla.
 */
export function celebrarVenta(origen?: DOMRect | null): void {
  if (typeof document === "undefined") return;
  sonar();

  const destello = document.createElement("div");
  destello.className = "destello-venta";
  destello.setAttribute("aria-hidden", "true");
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
