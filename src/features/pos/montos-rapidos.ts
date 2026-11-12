/**
 * Montos rápidos para cobrar en efectivo: los billetes con que el cliente
 * probablemente pague. Para $74 → $80, $100, $200. Siempre mayores que el
 * total (el "exacto" lo pone la pantalla aparte) y sin repetir.
 */
import type { Moneda } from "@/lib/money";

/** Billetes de cada moneda (migración 133: el negocio elige la suya). */
const DENOMINACIONES: Record<Moneda, readonly number[]> = {
  MXN: [20, 50, 100, 200, 500, 1000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200, 500],
};

export function montosRapidos(total: number, cuantos = 3, moneda: Moneda = "MXN"): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const montos = new Set<number>();
  for (const d of DENOMINACIONES[moneda]) {
    const redondeado = Math.ceil(total / d) * d;
    if (redondeado > total) montos.add(redondeado);
  }
  return [...montos].sort((a, b) => a - b).slice(0, cuantos);
}
