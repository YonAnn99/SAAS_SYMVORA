"use client";

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
import { formatMXN } from "@/lib/money";
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
  const { seleccionada: sucursalId } = useSucursal();
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
          Compras del periodo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lo invertido en mercancía. No se resta de la ganancia: esa ya
          descuenta el costo de lo vendido.
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
                etiqueta="Total comprado"
                valor={formatMXN(resumen.totalComprado)}
                detalle={`${resumen.numeroCompras} ${
                  resumen.numeroCompras === 1 ? "compra" : "compras"
                }`}
              />
              <Cifra
                etiqueta="Pagado con efectivo de caja"
                valor={formatMXN(resumen.pagadoConCaja)}
                detalle="Salió del cajón"
              />
              <Cifra
                etiqueta="Ventas − compras"
                valor={formatMXN(resumen.diferencia)}
                detalle={`Ventas: ${formatMXN(totalVentas)}`}
                negativo={resumen.diferencia < 0}
              />
              <Cifra
                etiqueta="Pendiente por recibir"
                valor={formatMXN(resumen.pendientePorRecibir)}
                detalle={`${resumen.ordenesAbiertas} ${
                  resumen.ordenesAbiertas === 1 ? "orden abierta" : "órdenes abiertas"
                } · al día de hoy`}
              />
            </div>

            {resumen.numeroCompras > 0 ? (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <VentasVsComprasChart
                    title="Ventas vs compras"
                    ventas={totalVentas}
                    compras={resumen.totalComprado}
                  />
                  <DonaConLeyenda
                    title="Cómo se pagaron las compras"
                    data={comoSePagaron(resumen)}
                    mostrarMonto
                    simple
                  />
                </div>
                {resumen.topProveedores.length > 0 && (
                  <ProveedoresChart
                    title="Proveedores con más compras"
                    data={resumen.topProveedores}
                  />
                )}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Sin compras en este periodo
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
function comoSePagaron(resumen: ResumenCompras): { name: string; value: number }[] {
  const otros = Math.max(0, Math.round((resumen.totalComprado - resumen.pagadoConCaja) * 100) / 100);
  return [
    { name: "Efectivo de caja", value: resumen.pagadoConCaja },
    { name: "Otros medios", value: otros },
  ].filter((s) => s.value > 0);
}

function Cifra({
  etiqueta,
  valor,
  detalle,
  negativo = false,
}: {
  etiqueta: string;
  valor: string;
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
        {valor}
      </p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
