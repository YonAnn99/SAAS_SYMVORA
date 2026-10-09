"use client";

import "./registro";
import { Chart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { ejeCategorias, ejeMontos, leyendaBase, opcionesBase, tooltipBase } from "./opciones";
import { montoCompleto } from "./formato-grafica";
import { TarjetaGrafica } from "./tarjeta-grafica";

/**
 * Ingresos (sin IVA) en barras y ganancia en linea, por cubeta del periodo.
 * La leyenda de abajo es de Chart.js: un clic oculta o muestra la serie.
 */
export function IngresosGananciaChart({
  data,
  title,
  productosSinCosto,
}: {
  data: { date: string; ingresos: number; ganancia: number }[];
  title: string;
  /** Productos vendidos sin costo capturado: no entran (misma nota que la tarjeta). */
  productosSinCosto: number;
}) {
  const tema = useTemaGrafica();
  const vacia = data.every((d) => d.ingresos === 0 && d.ganancia === 0);

  const datos: ChartData<"bar" | "line"> = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        type: "line" as const,
        label: "Ganancia",
        data: data.map((d) => d.ganancia),
        borderColor: tema.serie[1],
        backgroundColor: tema.serie[1],
        borderWidth: 2,
        tension: 0.35,
        pointRadius: data.length > 31 ? 0 : 3,
        pointHoverRadius: 5,
        order: 1,
      },
      {
        type: "bar" as const,
        label: "Ingresos (sin IVA)",
        data: data.map((d) => d.ingresos),
        backgroundColor: tema.principal,
        borderRadius: 4,
        maxBarThickness: 32,
        order: 2,
      },
    ],
  };

  const opciones: ChartOptions<"bar" | "line"> = {
    ...opcionesBase<"bar" | "line">(tema),
    // `beginAtZero` (de ejeMontos) igual baja del cero si hay ganancia negativa.
    scales: { x: ejeCategorias(tema), y: ejeMontos(tema) },
    plugins: {
      legend: leyendaBase(tema),
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${montoCompleto(Number(ctx.parsed.y))}`,
        },
      },
    },
  };

  return (
    <TarjetaGrafica
      title={title}
      vacia={vacia}
      pie={
        productosSinCosto > 0 ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            {productosSinCosto === 1
              ? "1 producto sin costo capturado no se incluye."
              : `${productosSinCosto} productos sin costo capturado no se incluyen.`}
          </p>
        ) : null
      }
    >
      <Chart type="bar" data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}
