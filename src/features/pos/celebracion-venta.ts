/**
 * La celebracion al confirmar una venta: sonido `sale_finish.mp3` y destello
 * verde. Atajos sobre `lib/celebracion.ts`, que comparte el efecto con el alta
 * de productos (en azul).
 */

import { COLOR_VENTA, SONIDO_VENTA, celebrar, precargarSonido } from "@/lib/celebracion";

/** Deja el sonido descargado para que suene sin retraso al confirmar. */
export function precargarSonidoVenta(): void {
  precargarSonido(SONIDO_VENTA);
}

/**
 * `origen`: de donde nace el circulo verde (normalmente el boton de cobrar).
 * Sin origen, desde el centro de la pantalla.
 */
export function celebrarVenta(origen?: DOMRect | null): void {
  celebrar({ origen, color: COLOR_VENTA, sonido: SONIDO_VENTA });
}
