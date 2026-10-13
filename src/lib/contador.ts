/**
 * Contador animado («count-up») de Dashboard y Reportes: el numero arranca en 0
 * y sube a su valor. Aqui va lo puro (curva y formato); el componente esta en
 * `components/ui/contador-animado.tsx`.
 */

/** Duracion de la animacion, en milisegundos. */
export const DURACION_MS = 1100;
/** Espera antes de empezar a contar, en milisegundos. */
export const RETRASO_MS = 120;

/** Expo-out: sube muy rapido al principio y frena suave al llegar. `t` de 0 a 1. */
export function easeOutExpo(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - 2 ** (-10 * t);
}

export interface FormatoContador {
  /** Antes del numero, ej. "$". */
  prefijo?: string;
  /** Despues del numero, ej. "%". */
  sufijo?: string;
  decimales?: number;
}

/**
 * `14542` → "$14,542"; `-1147.25` → "-$1,147.25". El signo va antes del
 * prefijo, y un valor que redondeado da 0 sale sin signo (un cuadro intermedio
 * de una cifra negativa no debe pintar "-$0.00").
 */
export function formatearContador(
  valor: number,
  { prefijo = "", sufijo = "", decimales = 0 }: FormatoContador = {}
): string {
  const factor = 10 ** decimales;
  const redondeado = Math.round(Math.abs(valor) * factor) / factor;
  const signo = valor < 0 && redondeado !== 0 ? "-" : "";
  const numero = redondeado.toLocaleString("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  return `${signo}${prefijo}${numero}${sufijo}`;
}
