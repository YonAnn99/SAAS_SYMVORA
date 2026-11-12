"use client";

import { useTranslations } from "next-intl";
import { BarrasHorizontales } from "./barras-horizontales";
import { montoCompleto, montoEje } from "./formato-grafica";
import { useMonedaDelNegocio } from "@/contexts/tenant-context";
import { ALTO_GRAFICA_CHICA } from "./tarjeta-grafica";

interface TopProductsChartProps {
  data: { nombre: string; cantidad: number }[];
  title: string;
}

const formatoCantidad = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

export function TopProductsChart({ data, title }: TopProductsChartProps) {
  const t = useTranslations("charts");
  return (
    <BarrasHorizontales
      title={title}
      etiquetas={data.map((d) => d.nombre)}
      valores={data.map((d) => d.cantidad)}
      nombreSerie={t("unitsSold")}
      formatoTooltip={(v) => t("soldCount", { cantidad: formatoCantidad.format(v) })}
      enteros
    />
  );
}

/** "Proveedores con más compras" dentro de la tarjeta de Compras de Reportes. */
export function ProveedoresChart({
  data,
  title,
}: {
  data: { nombre: string; total: number; compras: number }[];
  title: string;
}) {
  const moneda = useMonedaDelNegocio();
  const t = useTranslations("reports.charts");
  return (
    <BarrasHorizontales
      title={title}
      etiquetas={data.map((d) => d.nombre)}
      valores={data.map((d) => d.total)}
      nombreSerie={t("purchased")}
      formatoTooltip={(v) => montoCompleto(v, moneda)}
      formatoEje={(v) => montoEje(v, moneda)}
      detalleTooltip={(i) => {
        const n = data[i]?.compras ?? 0;
        return t("purchaseCount", { count: n });
      }}
      simple
      alto={ALTO_GRAFICA_CHICA}
    />
  );
}
