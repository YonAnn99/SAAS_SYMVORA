"use client";

import "./registro";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { ejeCategorias, ejeMontos, leyendaBase, opcionesBase, tooltipBase } from "./opciones";
import { montoCompleto } from "./formato-grafica";
import { TarjetaGrafica } from "./tarjeta-grafica";

interface SalesChartProps {
  data: { date: string; ventas: number }[];
  title: string;
  /**
   * Serie del periodo anterior, alineada por posicion con `data` (ver
   * `alinearComparacion`). Se pinta punteada y con leyenda para ocultarla.
   */
  comparacion?: { etiqueta: string; datos: number[] };
}

/** "#RRGGBB" + alfa → "rgba(...)" para el degradado del relleno. */
function conAlfa(color: string, alfa: number): string {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

export function SalesChart({ data, title, comparacion }: SalesChartProps) {
  const tema = useTemaGrafica();
  const conComparacion = Boolean(comparacion);

  const datos: ChartData<"line"> = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: "Ventas",
        data: data.map((d) => d.ventas),
        borderColor: tema.principal,
        borderWidth: 2,
        tension: 0.35,
        fill: "origin",
        // Degradado vertical calculado con el alto real del area de la grafica.
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const { chart } = ctx;
          const area = chart.chartArea;
          if (!area) return conAlfa(tema.principal, 0.1);
          const degradado = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          degradado.addColorStop(0, conAlfa(tema.principal, 0.22));
          degradado.addColorStop(1, conAlfa(tema.principal, 0));
          return degradado;
        },
        pointRadius: data.length > 31 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: tema.principal,
        order: 1,
      },
      ...(comparacion
        ? [
            {
              label: comparacion.etiqueta,
              data: comparacion.datos,
              borderColor: tema.textoSuave,
              borderWidth: 1.5,
              borderDash: [5, 4],
              tension: 0.35,
              fill: false,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointBackgroundColor: tema.textoSuave,
              order: 2,
            },
          ]
        : []),
    ],
  };

  const opciones: ChartOptions<"line"> = {
    ...opcionesBase<"line">(tema),
    scales: { x: ejeCategorias(tema), y: ejeMontos(tema) },
    plugins: {
      // Con una sola serie la leyenda sobra; con comparacion permite ocultarla.
      legend: { ...leyendaBase(tema), display: conComparacion },
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${montoCompleto(Number(ctx.parsed.y))}`,
        },
      },
    },
  };

  return (
    <TarjetaGrafica title={title} vacia={data.length === 0}>
      <Line data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}
