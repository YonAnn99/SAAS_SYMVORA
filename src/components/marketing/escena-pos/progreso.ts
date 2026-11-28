/**
 * Progreso de una escena fija (0 → 1) según cuánto se ha recorrido su contenedor.
 *
 * `topRelativo` es `getBoundingClientRect().top` del contenedor (negativo cuando ya
 * se subió). `altoContenedor` incluye la parte pegajosa; `altoVentana` es la altura
 * visible. El recorrido útil es `altoContenedor - altoVentana`: al llegar al final,
 * la escena ya salió por completo y el progreso vale 1.
 *
 * Pura a propósito: la prueba la cubre sin navegador.
 */
export function progresoEscena(topRelativo: number, altoContenedor: number, altoVentana: number): number {
  const recorrido = altoContenedor - altoVentana;
  if (!(recorrido > 0)) return 0;
  const avance = -topRelativo / recorrido;
  if (!Number.isFinite(avance)) return 0;
  return Math.min(1, Math.max(0, avance));
}
