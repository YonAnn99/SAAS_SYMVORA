"use client";

import dynamic from "next/dynamic";

const chartLoadingFallback = (
  <div className="h-[280px] w-full animate-pulse rounded-md bg-muted" />
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
