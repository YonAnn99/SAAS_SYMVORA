"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { mensajeDeError } from "@/features/inventory/error-message";
import { rangoDePeriodo, type Periodo } from "@/lib/periodo";
import {
  fetchDetalleVenta,
  fetchHistorialVentas,
  VENTAS_POR_PAGINA,
  type VentaEnHistorial,
} from "../services/sales-history-service";
import {
  construirReceiptDesdeVenta,
  type VentaGuardada,
} from "../sale-receipt-builder";
import type { SaleReceipt } from "@/features/pos/types/pos.types";
import { useSucursal } from "@/contexts/sucursal-context";

/**
 * El listado de ventas del historial.
 *
 * El periodo sale de `rangoDePeriodo`, la MISMA funcion que usan los agregados
 * de Reportes: si cada uno lo calculara por su cuenta, la tabla y las graficas
 * de la misma pantalla acabarian mostrando ventanas de tiempo distintas.
 *
 * La paginacion la hace el servidor. El reporte de agregados ya se trunca a
 * 5000 filas y avisa; traerse el historial entero al navegador de un comercio
 * con meses de ventas seria peor.
 */
export function useSalesHistory(
  tenantId: string | null,
  periodo: Periodo,
  fechaElegida: Date | null,
  cajeroId: string | null
) {
  const [ventas, setVentas] = useState<VentaEnHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  // La sucursal sale del selector global y no de una prop: asi el historial
  // obedece al MISMO selector que las graficas de Reportes que lo rodean.
  const { seleccionada: sucursalId } = useSucursal();

  const rango = useMemo(
    () => rangoDePeriodo(periodo, fechaElegida),
    [periodo, fechaElegida]
  );

  // Cambiar de filtro con la pagina 5 puesta dejaria una tabla vacia sin que
  // se entienda por que.
  useEffect(() => {
    const t = window.setTimeout(() => setPagina(0), 0);
    return () => window.clearTimeout(t);
  }, [periodo, fechaElegida, cajeroId, sucursalId]);

  const refetch = useCallback(async () => {
    if (!tenantId || !rango) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const pag = await fetchHistorialVentas({
        tenantId,
        desde: rango.desde,
        hasta: rango.hasta,
        cajeroId,
        sucursalId,
        limite: VENTAS_POR_PAGINA,
        desplazamiento: pagina * VENTAS_POR_PAGINA,
      });
      setVentas(pag.ventas);
      setTotal(pag.total);
    } catch (error: unknown) {
      toast.error(mensajeDeError(error));
    } finally {
      setCargando(false);
    }
  }, [tenantId, rango, cajeroId, sucursalId, pagina]);

  // Diferido, convencion del repo: un setState sincrono dentro de un efecto
  // encadena renders y dispara `react-hooks/set-state-in-effect`.
  useEffect(() => {
    const t = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(t);
  }, [refetch]);

  const totalPaginas = Math.max(1, Math.ceil(total / VENTAS_POR_PAGINA));

  return {
    ventas,
    total,
    pagina,
    totalPaginas,
    cargando,
    irAPagina: setPagina,
    refetch,
    /** `null` cuando el periodo es "dia" y aun no se eligio fecha. */
    sinFechaElegida: rango === null,
  };
}

/**
 * El desglose de UNA venta, y su ticket listo para reimprimir.
 *
 * Se pide al abrir el detalle y no al cargar la lista: traer los renglones de
 * las 25 ventas de la pagina seria trabajo tirado, porque el usuario abre una.
 */
export function useSaleDetail() {
  const [venta, setVenta] = useState<VentaGuardada | null>(null);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [cargando, setCargando] = useState(false);

  const abrir = useCallback(async (ventaId: string) => {
    setCargando(true);
    try {
      const detalle = await fetchDetalleVenta(ventaId);
      setVenta(detalle);
      setReceipt(construirReceiptDesdeVenta(detalle));
    } catch (error: unknown) {
      // El servidor rechaza una venta ajena con un mensaje claro; se muestra
      // tal cual en vez de un "error inesperado".
      toast.error(mensajeDeError(error));
      setVenta(null);
      setReceipt(null);
    } finally {
      setCargando(false);
    }
  }, []);

  const cerrar = useCallback(() => {
    setVenta(null);
    setReceipt(null);
  }, []);

  return { venta, receipt, cargando, abrir, cerrar };
}
