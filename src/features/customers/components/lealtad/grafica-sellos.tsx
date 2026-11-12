"use client";

import "@/components/charts/registro";
import { Bar } from "react-chartjs-2";
import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";
import type { ChartData, ChartOptions } from "chart.js";
import { useTemaGrafica } from "@/components/charts/use-tema-grafica";
import { ejeCategorias, opcionesBase, tooltipBase } from "@/components/charts/opciones";
import { ALTO_GRAFICA_CHICA, TarjetaGrafica } from "@/components/charts/tarjeta-grafica";

function etiquetaSemana(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(localeIntl(locale), { day: "numeric", month: "short" });
}

/**
 * Sellos sumados por semana (lunes a domingo), la actual resaltada. Va dentro
 * de la tarjeta del panel de lealtad (`simple`) y se carga con `next/dynamic`:
 * Chart.js solo baja al abrir la pestaña.
 */
export function GraficaSellos({ semanas }: { semanas: { inicio: string; sellos: number }[] }) {
  const tema = useTemaGrafica();
  const t = useTranslations("customers.loyalty.chart");
  const locale = useLocale();
  const valores = semanas.map((s) => s.sellos);
  const actual = semanas.length - 1;

  const datos: ChartData<"bar"> = {
    labels: semanas.map((s) => etiquetaSemana(s.inicio, locale)),
    datasets: [
      {
        label: t("stamps"),
        data: valores,
        backgroundColor: valores.map((_, i) => (i === actual ? tema.serie[1] : tema.principal)),
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const opciones: ChartOptions<"bar"> = {
    ...opcionesBase<"bar">(tema),
    scales: {
      x: ejeCategorias(tema),
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: tema.borde },
        ticks: { color: tema.textoSuave, font: { size: 11 }, precision: 0, maxTicksLimit: 5 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(tema),
        callbacks: {
          title: (items) => t("weekOf", { fecha: items[0]?.label ?? "" }),
          label: (ctx) => {
            const n = Number(ctx.parsed.y);
            return ` ${t("stampCount", { count: n })}`;
          },
        },
      },
    },
  };

  return (
    <TarjetaGrafica title={t("title")} vacia={valores.every((v) => v === 0)} simple alto={ALTO_GRAFICA_CHICA}>
      <Bar data={datos} options={opciones} />
    </TarjetaGrafica>
  );
}
