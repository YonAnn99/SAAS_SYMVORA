/**
 * Formatos de texto de las graficas. Logica pura (sin Chart.js) para poder
 * probarla: es lo que el comerciante lee en ejes y tooltips.
 */
import { formatMoneda, formatMonedaCompacto, type Moneda } from "@/lib/money";

/** Monto completo para tooltips: "$1,234.50" (o en la moneda del negocio). */
export function montoCompleto(n: number, moneda: Moneda = "MXN"): string {
  return formatMoneda(n, moneda);
}

/** Monto corto para ejes, donde no cabe el completo: "$1.2 k", "$850". */
export function montoEje(n: number, moneda: Moneda = "MXN"): string {
  return formatMonedaCompacto(n, moneda);
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
