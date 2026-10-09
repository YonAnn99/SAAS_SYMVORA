"use client";

import dynamic from "next/dynamic";
import { ALTO_GRAFICA, ALTO_GRAFICA_CHICA } from "./tarjeta-grafica";

// Chart.js solo se descarga al abrir una pantalla con graficas.
const chartLoadingFallback = (
  <div className={`${ALTO_GRAFICA} w-full animate-pulse rounded-md bg-muted`} />
);

export const SalesChart = dynamic(
  () => import("./sales-chart").then((m) => m.SalesChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const TopProductsChart = dynamic(
  () => import("./top-products-chart").then((m) => m.TopProductsChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const PaymentMethodsChart = dynamic(
  () => import("./payment-methods-chart").then((m) => m.PaymentMethodsChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const VentasPorHoraChart = dynamic(
  () => import("./ventas-por-hora-chart").then((m) => m.VentasPorHoraChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const VentasPorDiaSemanaChart = dynamic(
  () => import("./ventas-por-hora-chart").then((m) => m.VentasPorDiaSemanaChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const IngresosGananciaChart = dynamic(
  () => import("./ingresos-ganancia-chart").then((m) => m.IngresosGananciaChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

export const TopCategoriasChart = dynamic(
  () => import("./payment-methods-chart").then((m) => m.TopCategoriasChart),
  { ssr: false, loading: () => chartLoadingFallback }
);

// Las de la tarjeta de Compras van sin tarjeta propia y mas bajas.
const fallbackChico = (
  <div className={`${ALTO_GRAFICA_CHICA} w-full animate-pulse rounded-md bg-muted`} />
);

export const DonaConLeyenda = dynamic(
  () => import("./dona-con-leyenda").then((m) => m.DonaConLeyenda),
  { ssr: false, loading: () => fallbackChico }
);

export const ProveedoresChart = dynamic(
  () => import("./top-products-chart").then((m) => m.ProveedoresChart),
  { ssr: false, loading: () => fallbackChico }
);

export const VentasVsComprasChart = dynamic(
  () => import("./ventas-vs-compras-chart").then((m) => m.VentasVsComprasChart),
  { ssr: false, loading: () => fallbackChico }
);
