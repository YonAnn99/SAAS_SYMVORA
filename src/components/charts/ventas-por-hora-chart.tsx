"use client";

import "./registro";
import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { ejeCategorias, ejeMontos, opcionesBase, tooltipBase } from "./opciones";
import { montoCompleto } from "./formato-grafica";
import { TarjetaGrafica } from "./tarjeta-grafica";

/**
 * Ventas por bloque de tiempo (hora del dia o dia de la semana) en barras, con
 * la barra mas alta resaltada: responde "¿cuando vendo mas?".
 */
export function BarrasPorBloque({
  title,
  etiquetas,
  totales,
  numeroVentas,
  ayuda,
}: {
  title: string;
  etiquetas: string[];
  totales: number[];
  numeroVentas: number[];
  ayuda: string;
}) {
  const tema = useTemaGrafica();
  const maximo = Math.max(0, ...totales);
  const vacia = maximo === 0;
  const pico = totales.indexOf(maximo);

  const datos: ChartData<"bar"> = {
    labels: etiquetas,
    datasets: [
      {
        label: "Ventas",
        data: totales,
        backgroundColor: totales.map((_, i) => (i === pico ? tema.serie[1] : tema.principal)),
        borderRadius: 4,
        maxBarThickness: 32,
      },
    ],
  };

  const opciones: ChartOptions<"bar"> = {
    ...opcionesBase<"bar">(tema),
    scales: { x: ejeCategorias(tema), y: ejeMontos(tema) },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          label: (ctx) => {
            const n = numeroVentas[ctx.dataIndex] ?? 0;
            return ` ${montoCompleto(Number(ctx.parsed.y))} · ${n} ${n === 1 ? "venta" : "ventas"}`;
          },
        },
      },
    },
  };

  return (
    <TarjetaGrafica
      title={title}
      vacia={vacia}
      pie={
        <p className="mt-3 text-xs text-muted-foreground">
          {ayuda}{" "}
          <span className="font-medium text-foreground">
            {etiquetas[pico]} ({montoCompleto(maximo)})
          </span>
        </p>
      }
    >
      <Bar data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}

export function VentasPorHoraChart({
  data,
  title,
}: {
  data: { hora: string; total: number; ventas: number }[];
  title: string;
}) {
  return (
    <BarrasPorBloque
      title={title}
      etiquetas={data.map((d) => d.hora)}
      totales={data.map((d) => d.total)}
      numeroVentas={data.map((d) => d.ventas)}
      ayuda="Hora con más ventas:"
    />
  );
}

export function VentasPorDiaSemanaChart({
  data,
  title,
}: {
  data: { dia: string; total: number; ventas: number }[];
  title: string;
}) {
  return (
    <BarrasPorBloque
      title={title}
      etiquetas={data.map((d) => d.dia)}
      totales={data.map((d) => d.total)}
      numeroVentas={data.map((d) => d.ventas)}
      ayuda="Día más fuerte:"
    />
  );
}
