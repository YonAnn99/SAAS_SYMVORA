"use client";

import { useTranslations } from "next-intl";

/**
 * "Compras del periodo" en Reportes: cuánto se compró, a quién, cuánto salió
 * del efectivo de la caja y cuánto está pedido sin llegar.
 *
 * Es una vista de flujo, aparte de la ganancia (ver `compras-resumen.ts`).
 * Sigue el mismo periodo y la misma sucursal que el resto del reporte.
 */

import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ContadorAnimado } from "@/components/ui/contador-animado";
import { useMoneda } from "@/hooks/use-moneda";
import { rangoDePeriodo, type Periodo } from "@/lib/periodo";
import { useSucursal } from "@/contexts/sucursal-context";
import {
  DonaConLeyenda,
  ProveedoresChart,
  VentasVsComprasChart,
} from "@/components/charts/dynamic-charts";
import {
  resumenCompras,
  type CompraParaResumen,
  type OrdenAbiertaParaResumen,
  type ResumenCompras,
} from "../compras-resumen";

interface ComprasPeriodoCardProps {
  tenantId: string;
  periodo: Periodo;
  fechaElegida: Date | null;
  /** Las ventas del mismo periodo, ya calculadas por el reporte. */
  totalVentas: number;
}

type CompraConPagos = CompraParaResumen & {
  pagos: { monto: number; concepto: string | null }[] | null;
};

export function ComprasPeriodoCard({
  tenantId,
  periodo,
  fechaElegida,
  totalVentas,
}: ComprasPeriodoCardProps) {
  const { formatear } = useMoneda();
  const { seleccionada: sucursalId } = useSucursal();
  const t = useTranslations("reports.purchases");
  const [datos, setDatos] = useState<{
    compras: CompraConPagos[];
    ordenes: OrdenAbiertaParaResumen[];
  } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const rango = rangoDePeriodo(periodo, fechaElegida);
    if (!rango) return;
    let vigente = true;

    const t0 = window.setTimeout(async () => {
      setCargando(true);
      const supabase = createSupabaseBrowserClient();

      // Las salidas de caja van embebidas en su compra (FK `compra_id`,
      // migracion 093): asi no hace falta un `.in()` con cientos de ids.
      let qCompras = supabase
        .from("compras")
        .select(
          "id, total, estado, proveedor:proveedores!proveedor_id(nombre), pagos:movimientos_caja(monto, concepto)"
        )
        .eq("tenant_id", tenantId)
        .gte("fecha_compra", rango.desde.toISOString())
        .lte("fecha_compra", rango.hasta.toISOString());
      // `null` = todas las sucursales, mismo criterio que el resto del reporte.
      if (sucursalId) qCompras = qCompras.eq("sucursal_id", sucursalId);

      // Lo pendiente es una foto de HOY: no depende del periodo elegido.
      let qOrdenes = supabase
        .from("ordenes_compra")
        .select(
          "subtotal, impuesto, detalle:detalle_orden_compra(cantidad_solicitada, cantidad_recibida, costo_unitario)"
        )
        .eq("tenant_id", tenantId)
        .in("estado", ["ENVIADA", "RECIBIDA_PARCIAL"]);
      if (sucursalId) qOrdenes = qOrdenes.eq("sucursal_id", sucursalId);

      const [{ data: compras }, { data: ordenes }] = await Promise.all([
        qCompras,
        qOrdenes,
      ]);
      if (!vigente) return;
      setDatos({
        compras: (compras as unknown as CompraConPagos[] | null) ?? [],
        ordenes: (ordenes as unknown as OrdenAbiertaParaResumen[] | null) ?? [],
      });
      setCargando(false);
    }, 0);

    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [tenantId, periodo, fechaElegida, sucursalId]);

  const resumen: ResumenCompras | null = datos
    ? resumenCompras({
        compras: datos.compras,
        pagosCaja: datos.compras.flatMap((c) =>
          (c.pagos ?? [])
            .filter((p) => p.concepto === "COMPRA")
            .map((p) => ({ compra_id: c.id, monto: p.monto }))
        ),
        ordenesAbiertas: datos.ordenes,
        totalVentas,
      })
    : null;

  return (
    <Card className="animate-fade-in-up stagger-5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Truck className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("desc")}
        </p>
      </CardHeader>
      <CardContent>
        {cargando || !resumen ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Cifra
                etiqueta={t("total")}
                monto={resumen.totalComprado}
                detalle={t("count", { count: resumen.numeroCompras })}
              />
              <Cifra
                etiqueta={t("paidCash")}
                monto={resumen.pagadoConCaja}
                detalle={t("fromDrawer")}
              />
              <Cifra
                etiqueta={t("salesMinus")}
                monto={resumen.diferencia}
                detalle={t("salesAmount", { monto: formatear(totalVentas) })}
                negativo={resumen.diferencia < 0}
              />
              <Cifra
                etiqueta={t("pending")}
                monto={resumen.pendientePorRecibir}
                detalle={t("openOrders", { count: resumen.ordenesAbiertas })}
              />
            </div>

            {resumen.numeroCompras > 0 ? (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <VentasVsComprasChart
                    title={t("salesVsPurchases")}
                    ventas={totalVentas}
                    compras={resumen.totalComprado}
                  />
                  <DonaConLeyenda
                    title={t("howPaid")}
                    data={comoSePagaron(resumen, { caja: t("cashRegister"), otros: t("otherMeans") })}
                    mostrarMonto
                    simple
                  />
                </div>
                {resumen.topProveedores.length > 0 && (
                  <ProveedoresChart
                    title={t("topSuppliers")}
                    data={resumen.topProveedores}
                  />
                )}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                {t("none")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Segmentos de "Como se pagaron": lo que salio del efectivo de alguna caja y el
 * resto (transferencia, tarjeta, credito del proveedor...). Los vacios no van:
 * una dona con un segmento en 0 solo agrega una fila "0%" a la leyenda.
 */
function comoSePagaron(
  resumen: ResumenCompras,
  nombres: { caja: string; otros: string }
): { name: string; value: number }[] {
  const otros = Math.max(0, Math.round((resumen.totalComprado - resumen.pagadoConCaja) * 100) / 100);
  return [
    { name: nombres.caja, value: resumen.pagadoConCaja },
    { name: nombres.otros, value: otros },
  ].filter((s) => s.value > 0);
}

function Cifra({
  etiqueta,
  monto,
  detalle,
  negativo = false,
}: {
  etiqueta: string;
  /** Cuenta desde 0 hasta el monto (`ContadorAnimado`). */
  monto: number;
  detalle: string;
  negativo?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {etiqueta}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-semibold tracking-tight ${
          negativo ? "text-[#9F2F2D] dark:text-[#F2A5A4]" : ""
        }`}
      >
        <ContadorAnimado valor={monto} dinero />
      </p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
