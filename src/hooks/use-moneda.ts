"use client";

import { useMemo } from "react";
import { useMonedaDelNegocio } from "@/contexts/tenant-context";
import {
  formatMoneda,
  formatMonedaCompacto,
  formatMonedaEntero,
  simboloMoneda,
  type Moneda,
} from "@/lib/money";

export interface FormatoMoneda {
  moneda: Moneda;
  /** "$1,234.50" o "1234,50 €". */
  formatear: (n: number) => string;
  /** Corto, para ejes: "$1.2 k". */
  compacto: (n: number) => string;
  /** Sin decimales: "$200", "50 €". */
  entero: (n: number) => string;
  simbolo: string;
}

/**
 * Montos en la moneda del negocio (`tenants.moneda`). Toda pantalla del panel
 * que pinte dinero usa esto en vez de `formatMXN` o `$${n.toFixed(2)}`.
 */
export function useMoneda(): FormatoMoneda {
  const moneda = useMonedaDelNegocio();
  return useMemo(
    () => ({
      moneda,
      formatear: (n: number) => formatMoneda(n, moneda),
      compacto: (n: number) => formatMonedaCompacto(n, moneda),
      entero: (n: number) => formatMonedaEntero(n, moneda),
      simbolo: simboloMoneda(moneda),
    }),
    [moneda]
  );
}
