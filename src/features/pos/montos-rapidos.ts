/**
 * Montos rápidos para cobrar en efectivo: los billetes con que el cliente
 * probablemente pague. Para $74 → $80, $100, $200. Siempre mayores que el
 * total (el "exacto" lo pone la pantalla aparte) y sin repetir.
 */
const DENOMINACIONES = [20, 50, 100, 200, 500, 1000];

export function montosRapidos(total: number, cuantos = 3): number[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const montos = new Set<number>();
  for (const d of DENOMINACIONES) {
    const redondeado = Math.ceil(total / d) * d;
    if (redondeado > total) montos.add(redondeado);
  }
  return [...montos].sort((a, b) => a - b).slice(0, cuantos);
}
