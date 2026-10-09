/**
 * Opciones comunes de todas las graficas: tooltip con el estilo de la tarjeta,
 * ejes en pesos, rejilla discreta y animacion (salvo que el sistema pida menos
 * movimiento). Cada grafica parte de aqui y solo cambia lo suyo.
 */
import type { ChartOptions, ChartType, TooltipOptions } from "chart.js";
import type { TemaGrafica } from "./use-tema-grafica";
import { montoEje } from "./formato-grafica";

const FUENTE = { size: 11 };

export function tooltipBase(tema: TemaGrafica): Partial<TooltipOptions<ChartType>> {
  return {
    backgroundColor: tema.fondoTarjeta,
    borderColor: tema.borde,
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    titleColor: tema.texto,
    bodyColor: tema.textoSuave,
    titleFont: { size: 12, weight: 500 },
    bodyFont: { size: 12 },
    boxPadding: 4,
    usePointStyle: true,
  };
}

/** Escala de montos (eje Y de ventas, ingresos...). */
export function ejeMontos(tema: TemaGrafica) {
  return {
    beginAtZero: true,
    border: { display: false },
    grid: { color: tema.borde },
    ticks: {
      color: tema.textoSuave,
      font: FUENTE,
      maxTicksLimit: tema.compacto ? 4 : 6,
      callback: (valor: string | number) => montoEje(Number(valor)),
    },
  };
}

/** Escala de categorias (fechas, horas, dias). */
export function ejeCategorias(tema: TemaGrafica) {
  return {
    border: { display: false },
    grid: { display: false },
    ticks: {
      color: tema.textoSuave,
      font: FUENTE,
      autoSkip: true,
      maxRotation: 0,
      maxTicksLimit: tema.compacto ? 6 : 12,
    },
  };
}

export function leyendaBase(tema: TemaGrafica) {
  return {
    position: "bottom" as const,
    labels: {
      color: tema.textoSuave,
      font: FUENTE,
      usePointStyle: true,
      pointStyle: "circle" as const,
      boxWidth: 8,
      boxHeight: 8,
      padding: 16,
    },
  };
}

export function opcionesBase<T extends ChartType>(tema: TemaGrafica): ChartOptions<T> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: tema.reducirMovimiento ? false : { duration: 600, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
  } as ChartOptions<T>;
}
