"use client";

import "./registro";
import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { ejeCategorias, ejeMontos, opcionesBase, tooltipBase } from "./opciones";
import { montoCompleto } from "./formato-grafica";
import { ALTO_GRAFICA_CHICA, TarjetaGrafica } from "./tarjeta-grafica";

/**
 * Ventas contra compras del mismo periodo (tarjeta de Compras de Reportes):
 * de un vistazo, si se compro mas de lo que se vendio. Es flujo, no ganancia.
 */
export function VentasVsComprasChart({
  ventas,
  compras,
  title,
}: {
  ventas: number;
  compras: number;
  title: string;
}) {
  const tema = useTemaGrafica();
  const diferencia = ventas - compras;

  const datos: ChartData<"bar"> = {
    labels: ["Ventas", "Compras"],
    datasets: [
      {
        label: "Monto",
        data: [ventas, compras],
        backgroundColor: [tema.principal, tema.serie[2]],
        borderRadius: 6,
        maxBarThickness: 56,
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
        callbacks: { label: (ctx) => ` ${montoCompleto(Number(ctx.parsed.y))}` },
      },
    },
  };

  return (
    <TarjetaGrafica
      title={title}
      vacia={ventas === 0 && compras === 0}
      simple
      alto={ALTO_GRAFICA_CHICA}
      pie={
        <p className="mt-2 text-xs text-muted-foreground">
          Diferencia:{" "}
          <span
            className={`font-mono font-medium ${
              diferencia < 0 ? "text-[#9F2F2D] dark:text-[#F2A5A4]" : "text-foreground"
            }`}
          >
            {montoCompleto(diferencia)}
          </span>
        </p>
      }
    >
      <Bar data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}
