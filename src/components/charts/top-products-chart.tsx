"use client";

import { BarrasHorizontales } from "./barras-horizontales";
import { montoCompleto, montoEje } from "./formato-grafica";
import { ALTO_GRAFICA_CHICA } from "./tarjeta-grafica";

interface TopProductsChartProps {
  data: { nombre: string; cantidad: number }[];
  title: string;
}

const formatoCantidad = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

export function TopProductsChart({ data, title }: TopProductsChartProps) {
  return (
    <BarrasHorizontales
      title={title}
      etiquetas={data.map((d) => d.nombre)}
      valores={data.map((d) => d.cantidad)}
      nombreSerie="Unidades vendidas"
      formatoTooltip={(v) => `${formatoCantidad.format(v)} vendidas`}
      enteros
    />
  );
}

/** "Proveedores con más compras" dentro de la tarjeta de Compras de Reportes. */
export function ProveedoresChart({
  data,
  title,
}: {
  data: { nombre: string; total: number; compras: number }[];
  title: string;
}) {
  return (
    <BarrasHorizontales
      title={title}
      etiquetas={data.map((d) => d.nombre)}
      valores={data.map((d) => d.total)}
      nombreSerie="Comprado"
      formatoTooltip={montoCompleto}
      formatoEje={montoEje}
      detalleTooltip={(i) => {
        const n = data[i]?.compras ?? 0;
        return `${n} ${n === 1 ? "compra" : "compras"}`;
      }}
      simple
      alto={ALTO_GRAFICA_CHICA}
    />
  );
}
