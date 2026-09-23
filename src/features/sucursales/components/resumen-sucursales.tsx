"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Package, TrendingUp, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMXN } from "@/lib/money";
import { useSucursal } from "@/contexts/sucursal-context";
import { mensajeDeError } from "@/features/inventory/error-message";
import {
  resumenPorSucursal,
  type CajaResumen,
  type FilaResumen,
  type StockResumen,
  type VentaResumen,
} from "@/features/sucursales/resumen";

/**
 * Comparativa de locales del mes en curso: ventas, existencias y caja.
 *
 * "Ver" cambia la sucursal elegida en TODO el panel (es el mismo selector que el
 * dashboard, Productos y Reportes), y los accesos de debajo llevan a esas
 * pantallas ya filtradas. Asi el modulo no duplica el dashboard: lo usa.
 */
export function ResumenSucursales({ tenantId }: { tenantId: string }) {
  const { sucursales, seleccionada, setSeleccionada } = useSucursal();
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [stock, setStock] = useState<StockResumen[]>([]);
  const [cajas, setCajas] = useState<CajaResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (sucursales.length === 0) return;
    setCargando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
      const ids = sucursales.map((s) => s.id);

      const [v, st, cAbiertas, cMes] = await Promise.all([
        supabase
          .from("ventas")
          .select("sucursal_id, total")
          .eq("tenant_id", tenantId)
          .eq("estado", "COMPLETADA")
          .gte("fecha_venta", inicioMes),
        // Acotado a las sucursales de ESTE negocio: RLS deja ver las de todos
        // los negocios del usuario, y sumarlas mezclaria locales ajenos.
        supabase.from("stock_sucursal").select("sucursal_id, cantidad").in("sucursal_id", ids),
        supabase
          .from("cajas")
          .select("sucursal_id, estado, diferencia")
          .eq("tenant_id", tenantId)
          .eq("estado", "ABIERTA"),
        supabase
          .from("cajas")
          .select("sucursal_id, estado, diferencia")
          .eq("tenant_id", tenantId)
          .eq("estado", "CERRADA")
          .gte("fecha_cierre", inicioMes),
      ]);
      for (const r of [v, st, cAbiertas, cMes]) if (r.error) throw r.error;

      setVentas((v.data ?? []) as VentaResumen[]);
      setStock((st.data ?? []) as StockResumen[]);
      setCajas([...(cAbiertas.data ?? []), ...(cMes.data ?? [])] as CajaResumen[]);
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setCargando(false);
    }
  }, [tenantId, sucursales]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(t0);
  }, [cargar]);

  const { filas, total } = useMemo(
    () => resumenPorSucursal(sucursales, ventas, stock, cajas),
    [sucursales, ventas, stock, cajas]
  );

  const nombreElegida = sucursales.find((s) => s.id === seleccionada)?.nombre;

  const celdas = (f: FilaResumen) => (
    <>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatMXN(f.ventas)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">{f.tickets}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {formatMXN(f.ticketPromedio)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">
        {f.unidades.toLocaleString("es-MX")}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">{f.cajasAbiertas}</TableCell>
      <TableCell
        className={`text-right font-mono text-xs tabular-nums ${
          f.diferenciaCortes < 0 ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {formatMXN(f.diferenciaCortes)}
      </TableCell>
    </>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Este mes, por sucursal
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ventas completadas del mes, existencias actuales y cortes de caja. La
            última fila es la suma de todos los locales.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Cajas abiertas</TableHead>
                <TableHead className="text-right" title="Sobrante (+) o faltante (−) acumulado en los cortes del mes">
                  Dif. en cortes
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow
                  key={f.sucursalId ?? "sin-sucursal"}
                  className={f.sucursalId && f.sucursalId === seleccionada ? "bg-muted/50" : ""}
                >
                  <TableCell className="text-xs font-medium">
                    {f.nombre}
                    {!f.activa && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(cerrada)</span>
                    )}
                  </TableCell>
                  {celdas(f)}
                  <TableCell className="text-right">
                    {f.sucursalId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setSeleccionada(f.sucursalId)}
                        disabled={f.sucursalId === seleccionada}
                      >
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        Ver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell className="text-xs">{total.nombre}</TableCell>
                {celdas(total)}
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
          {cargando && (
            <p className="pt-3 text-center text-xs text-muted-foreground">Cargando…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {nombreElegida ? (
              <>
                Estás viendo <span className="font-semibold">{nombreElegida}</span> en todo el
                panel.
              </>
            ) : (
              <>Estás viendo <span className="font-semibold">todas las sucursales</span> juntas.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5")}>
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              Estadísticas
            </Link>
            <Link href="/products" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5")}>
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              Productos
            </Link>
            <Link href="/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5")}>
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Reportes
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
