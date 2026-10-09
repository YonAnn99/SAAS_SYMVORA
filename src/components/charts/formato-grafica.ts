/**
 * Formatos de texto de las graficas. Logica pura (sin Chart.js) para poder
 * probarla: es lo que el comerciante lee en ejes y tooltips.
 */
import { formatMXN } from "@/lib/money";

const MXN_COMPACTO = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Monto completo para tooltips: "$1,234.50". */
export function montoCompleto(n: number): string {
  return formatMXN(n);
}

/** Monto corto para ejes, donde no cabe el completo: "$1.2 k", "$850". */
export function montoEje(n: number): string {
  return MXN_COMPACTO.format(n);
}

/** Nombre recortado con "…" para que la etiqueta del eje no se coma la barra. */
export function recortarEtiqueta(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  return `${texto.slice(0, Math.max(1, maximo - 1)).trimEnd()}…`;
}

/** Porcentaje entero de `valor` sobre `total`; 0 si no hay total. */
export function porcentaje(valor: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((valor / total) * 100);
}
