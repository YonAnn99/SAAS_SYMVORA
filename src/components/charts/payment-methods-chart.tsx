"use client";

import { DonaConLeyenda } from "./dona-con-leyenda";

interface PaymentMethodsChartProps {
  data: { name: string; value: number }[];
  title: string;
}

export function PaymentMethodsChart({ data, title }: PaymentMethodsChartProps) {
  return <DonaConLeyenda data={data} title={title} />;
}

/** Ventas por categoria del periodo (Reportes), con monto y porcentaje. */
export function TopCategoriasChart({ data, title }: PaymentMethodsChartProps) {
  return <DonaConLeyenda data={data} title={title} mostrarMonto />;
}
