"use client";

import "./registro";
import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { ejeCategorias, opcionesBase, tooltipBase } from "./opciones";
import { recortarEtiqueta } from "./formato-grafica";
import { TarjetaGrafica } from "./tarjeta-grafica";

/**
 * Ranking en barras horizontales (top productos, proveedores). El nombre se
 * recorta en el eje y va completo en el tooltip.
 */
export function BarrasHorizontales({
  title,
  etiquetas,
  valores,
  nombreSerie,
  formatoTooltip,
  formatoEje,
  detalleTooltip,
  enteros = false,
  simple = false,
  alto,
}: {
  title: string;
  etiquetas: string[];
  valores: number[];
  nombreSerie: string;
  /** Texto del valor en el tooltip ("3 vendidas", "$1,200.00"). */
  formatoTooltip: (valor: number) => string;
  /** Texto de las marcas del eje de valores. */
  formatoEje?: (valor: number) => string;
  /** Linea extra del tooltip para el elemento `i` ("4 compras"). */
  detalleTooltip?: (i: number) => string;
  /** Marcas del eje sin decimales (cantidades). */
  enteros?: boolean;
  simple?: boolean;
  alto?: string;
}) {
  const tema = useTemaGrafica();

  const datos: ChartData<"bar"> = {
    labels: etiquetas,
    datasets: [
      {
        label: nombreSerie,
        data: valores,
        backgroundColor: tema.principal,
        hoverBackgroundColor: tema.serie[1],
        borderRadius: 4,
        borderSkipped: "start",
        maxBarThickness: 24,
      },
    ],
  };

  const baseX = ejeCategorias(tema);
  const opciones: ChartOptions<"bar"> = {
    ...opcionesBase<"bar">(tema),
    indexAxis: "y",
    interaction: { mode: "nearest", axis: "y", intersect: false },
    scales: {
      x: {
        ...baseX,
        beginAtZero: true,
        grid: { color: tema.borde },
        ticks: {
          ...baseX.ticks,
          ...(enteros ? { precision: 0 } : {}),
          ...(formatoEje ? { callback: (v: string | number) => formatoEje(Number(v)) } : {}),
        },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: tema.textoSuave,
          font: { size: 11 },
          autoSkip: false,
          callback: (_valor, indice) =>
            recortarEtiqueta(etiquetas[indice] ?? "", tema.compacto ? 12 : 20),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          title: (items) => etiquetas[items[0]?.dataIndex ?? 0] ?? "",
          label: (ctx) => ` ${formatoTooltip(Number(ctx.parsed.x))}`,
          ...(detalleTooltip
            ? { afterLabel: (ctx: { dataIndex: number }) => ` ${detalleTooltip(ctx.dataIndex)}` }
            : {}),
        },
      },
    },
  };

  return (
    <TarjetaGrafica title={title} vacia={valores.length === 0} simple={simple} alto={alto}>
      <Bar data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}
