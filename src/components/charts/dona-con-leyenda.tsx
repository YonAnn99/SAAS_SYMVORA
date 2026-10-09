"use client";

import "./registro";
import { useEffect, useRef, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { Chart, ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "./use-tema-grafica";
import { opcionesBase, tooltipBase } from "./opciones";
import { montoCompleto, porcentaje } from "./formato-grafica";
import { TarjetaGrafica } from "./tarjeta-grafica";

export interface DonaConLeyendaProps {
  data: { name: string; value: number }[];
  title: string;
  /** La leyenda muestra el monto ademas del porcentaje. */
  mostrarMonto?: boolean;
  /** Sin tarjeta propia (va dentro de otra). */
  simple?: boolean;
}

/**
 * Dona con leyenda HTML clicable: un clic oculta o muestra el segmento y los
 * porcentajes se recalculan sobre lo visible. La usan Metodos de pago, Top
 * categorias y "Como se pagaron" de Compras.
 */
export function DonaConLeyenda({
  data,
  title,
  mostrarMonto = false,
  simple = false,
}: DonaConLeyendaProps) {
  const tema = useTemaGrafica();
  const graficaRef = useRef<Chart<"doughnut"> | null>(null);
  // Ocultos por nombre: si cambia el periodo y el orden de los datos, lo
  // oculto sigue siendo el mismo elemento.
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  const colores = data.map((_, i) => tema.serie[i % tema.serie.length]);
  const totalVisible = data.reduce((suma, d) => (ocultos.has(d.name) ? suma : suma + d.value), 0);

  // Chart.js guarda lo oculto por INDICE; aqui manda el estado por nombre. Se
  // sincroniza tras cada cambio de datos u ocultos para que no se desfasen.
  useEffect(() => {
    const grafica = graficaRef.current;
    if (!grafica) return;
    let cambio = false;
    data.forEach((d, i) => {
      const debeVerse = !ocultos.has(d.name);
      if (grafica.getDataVisibility(i) !== debeVerse) {
        grafica.toggleDataVisibility(i);
        cambio = true;
      }
    });
    if (cambio) grafica.update();
  }, [data, ocultos]);

  const alternar = (nombre: string) => {
    setOcultos((previos) => {
      const siguientes = new Set(previos);
      if (siguientes.has(nombre)) siguientes.delete(nombre);
      else siguientes.add(nombre);
      return siguientes;
    });
  };

  const datos: ChartData<"doughnut"> = {
    labels: data.map((d) => d.name),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: colores,
        borderColor: tema.fondoTarjeta,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const opciones: ChartOptions<"doughnut"> = {
    ...opcionesBase<"doughnut">(tema),
    cutout: "62%",
    interaction: { mode: "nearest", intersect: true },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          label: (ctx) =>
            ` ${ctx.label}: ${montoCompleto(Number(ctx.parsed))} (${porcentaje(
              Number(ctx.parsed),
              totalVisible
            )}%)`,
        },
      },
    },
  };

  const tamano = simple
    ? "h-[150px] w-[150px] sm:h-[170px] sm:w-[170px]"
    : "h-[180px] w-[180px] sm:h-[200px] sm:w-[200px]";

  return (
    <TarjetaGrafica title={title} vacia={data.length === 0} sinContenedor simple={simple}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className={`relative shrink-0 ${tamano}`}>
          <Doughnut ref={graficaRef} data={datos} options={opciones} />
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {data.map((entry, index) => {
            const oculto = ocultos.has(entry.name);
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  onClick={() => alternar(entry.name)}
                  aria-pressed={!oculto}
                  title={oculto ? "Mostrar en la gráfica" : "Ocultar de la gráfica"}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full transition-opacity"
                    style={{ backgroundColor: colores[index], opacity: oculto ? 0.3 : 1 }}
                  />
                  <span
                    className={`min-w-0 truncate text-muted-foreground ${oculto ? "line-through opacity-60" : ""}`}
                  >
                    {entry.name}
                  </span>
                  <span className="ml-auto shrink-0 text-right font-medium tabular-nums">
                    {oculto ? (
                      "—"
                    ) : mostrarMonto ? (
                      <>
                        <span className="font-mono text-xs">{montoCompleto(entry.value)}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {porcentaje(entry.value, totalVisible)}%
                        </span>
                      </>
                    ) : (
                      `${porcentaje(entry.value, totalVisible)}%`
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </TarjetaGrafica>
  );
}
