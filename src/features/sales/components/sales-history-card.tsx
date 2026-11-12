"use client";

/**
 * El historial de ventas del periodo elegido en Reportes.
 *
 * Vive dentro de Reportes y no en una ruta propia para reutilizar sus filtros
 * de periodo: el dueño ya elige ahí día/semana/mes/trimestre/año, y la tabla
 * responde al mismo selector que las gráficas. Comparten `rangoDePeriodo`, así
 * que no pueden mostrar ventanas de tiempo distintas.
 *
 * QUIÉN VE QUÉ: un cajero solo ve sus propias ventas. La regla la aplica el
 * RPC `listar_ventas` del lado del servidor; aquí solo se decide si se enseña
 * el selector de cajero, que sin `sales.view_all` no tendría nada que filtrar.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";
import { ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useSucursal } from "@/contexts/sucursal-context";
import { clavePagoI18n, numeroOperacion } from "@/features/pos/ticket-format";
import { useMoneda } from "@/hooks/use-moneda";
import type { Periodo } from "@/lib/periodo";
import { useSalesHistory } from "../hooks/use-sales-history";
import { SaleDetailDialog, EstadoVentaBadge } from "./sale-detail-dialog";

const TODOS_LOS_CAJEROS = "todos";
const TODOS_LOS_CLIENTES = "todos-los-clientes";

interface SalesHistoryCardProps {
  tenantId: string | null;
  periodo: Periodo;
  fechaElegida: Date | null;
  /** Sube con "Actualizar" de la pagina: vuelve a pedir la pagina actual. */
  version?: number;
}

interface Cajero {
  user_id: string;
  /** Nombre (migracion 101) o, si no tiene, el correo. */
  etiqueta: string;
}

function horaCorta(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function SalesHistoryCard({
  tenantId,
  periodo,
  fechaElegida,
  version = 0,
}: SalesHistoryCardProps) {
  const { formatear } = useMoneda();
  const t = useTranslations();
  const li = localeIntl(useLocale());
  const { can } = usePermissions();
  const veTodas = can("sales.view_all");
  // La columna solo aporta viendo varias sucursales a la vez: con una elegida
  // diria lo mismo en cada fila, y un negocio de un solo local no la necesita.
  const { hayVarias, seleccionada } = useSucursal();
  const verSucursal = hayVarias && seleccionada === null;

  const [cajeroSel, setCajeroSel] = useState<string>(TODOS_LOS_CAJEROS);
  // Las compras de un cliente (migracion 129): «¿qué me debe y de qué?».
  const [clienteSel, setClienteSel] = useState<string>(TODOS_LOS_CLIENTES);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [cajeros, setCajeros] = useState<Cajero[]>([]);
  const [ventaAbierta, setVentaAbierta] = useState<string | null>(null);

  const {
    ventas,
    total,
    pagina,
    totalPaginas,
    cargando,
    irAPagina,
    sinFechaElegida,
    refetch,
  } = useSalesHistory(
    tenantId,
    periodo,
    fechaElegida,
    cajeroSel === TODOS_LOS_CAJEROS ? null : cajeroSel,
    clienteSel === TODOS_LOS_CLIENTES ? null : clienteSel
  );

  // "Actualizar" de la pagina (el 0 inicial no cuenta: la carga ya corre sola).
  useEffect(() => {
    if (!version) return;
    void refetch();
    // Solo cuando sube la version, no cuando cambia `refetch`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // La lista de cajeros solo hace falta si se pueden ver las ventas de otros.
  useEffect(() => {
    if (!tenantId || !veTodas) return;
    const t0 = window.setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.rpc("get_tenant_members", {
        p_tenant_id: tenantId,
      });
      setCajeros(
        (
          (data ?? []) as { user_id: string; user_email: string; user_nombre: string | null }[]
        ).map((m) => ({
          user_id: m.user_id,
          etiqueta: m.user_nombre?.trim() || m.user_email,
        }))
      );
    }, 0);
    return () => window.clearTimeout(t0);
  }, [tenantId, veTodas]);

  // Los clientes del negocio, para el filtro. Sin clientes no hay selector.
  useEffect(() => {
    if (!tenantId) return;
    const t0 = window.setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre")
        .eq("tenant_id", tenantId)
        .order("nombre");
      setClientes((data ?? []) as { id: string; nombre: string }[]);
    }, 0);
    return () => window.clearTimeout(t0);
  }, [tenantId]);

  const desde = pagina * 25 + 1;
  const hasta = Math.min((pagina + 1) * 25, total);

  const cuerpo = useMemo(() => {
    if (sinFechaElegida) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("reports.history.pickDay")}
        </p>
      );
    }
    if (cargando) {
      return (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (ventas.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-10">
          <Receipt className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {veTodas ? t("reports.history.none") : t("reports.history.noneMine")}
          </p>
        </div>
      );
    }
    return (
      <>
        {/* Celular: renglones en vez de la tabla (5-7 columnas obligaban a
            desplazarse de lado). Abren el mismo detalle. */}
        <ul className="divide-y divide-border sm:hidden">
          {ventas.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setVentaAbierta(v.id)}
                className="flex w-full flex-col gap-0.5 py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-xs">
                  <span className="whitespace-nowrap text-muted-foreground">{horaCorta(v.fecha_venta, li)}</span>
                  <span className="font-mono">#{numeroOperacion(v.id)}</span>
                  <EstadoVentaBadge estado={v.estado} />
                  <span className="ml-auto shrink-0 font-mono text-sm font-medium tabular-nums">
                    {formatear(v.total)}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    v.cliente_nombre ?? t("reports.generalCustomer"),
                    t(clavePagoI18n(v.metodo_pago)),
                    veTodas ? v.cajero_nombre?.trim() || v.cajero_email : null,
                    verSucursal ? v.sucursal_nombre : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      <div className="max-sm:hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("reports.history.colDate")}</TableHead>
            <TableHead>{t("reports.history.colOperation")}</TableHead>
            {veTodas && <TableHead>{t("reports.history.colCashier")}</TableHead>}
            {verSucursal && <TableHead>{t("reports.history.colBranch")}</TableHead>}
            <TableHead>{t("reports.history.colCustomer")}</TableHead>
            <TableHead>{t("reports.history.colPayment")}</TableHead>
            <TableHead className="text-right">{t("reports.history.colTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ventas.map((v) => (
            <TableRow
              key={v.id}
              className="cursor-pointer"
              onClick={() => setVentaAbierta(v.id)}
            >
              <TableCell className="whitespace-nowrap text-xs">
                {horaCorta(v.fecha_venta, li)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                #{numeroOperacion(v.id)}
                <EstadoVentaBadge estado={v.estado} />
              </TableCell>
              {veTodas && (
                <TableCell className="max-w-[160px] truncate text-xs">
                  {v.cajero_nombre?.trim() || v.cajero_email || "—"}
                </TableCell>
              )}
              {verSucursal && (
                <TableCell className="max-w-[120px] truncate text-xs">
                  {v.sucursal_nombre ?? "—"}
                </TableCell>
              )}
              <TableCell className="max-w-[140px] truncate text-xs">
                {v.cliente_nombre ?? t("reports.generalCustomer")}
              </TableCell>
              <TableCell className="text-xs">
                {t(clavePagoI18n(v.metodo_pago))}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatear(v.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
      </>
    );
  }, [sinFechaElegida, cargando, ventas, veTodas, verSucursal, t, li, formatear]);

  return (
    <>
      <Card className="animate-fade-in-up stagger-6">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            {t("reports.history.title")}
            {total > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {total}
              </span>
            )}
          </CardTitle>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {clientes.length > 0 && (
            <Select value={clienteSel} onValueChange={(v) => v && setClienteSel(v)}>
              <SelectTrigger className="h-8 w-full sm:w-56" aria-label={t("reports.history.filterCustomer")}>
                <SelectValue>
                  {(valor: unknown) =>
                    valor === TODOS_LOS_CLIENTES
                      ? t("reports.history.allCustomers")
                      : clientes.find((c) => c.id === valor)?.nombre ?? t("reports.history.allCustomers")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_LOS_CLIENTES}>{t("reports.history.allCustomers")}</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sin `sales.view_all` no hay nada que filtrar: el servidor solo
              devuelve las ventas propias, así que el selector solo confundiría. */}
          {veTodas && cajeros.length > 1 && (
            <Select
              value={cajeroSel}
              onValueChange={(v) => v && setCajeroSel(v)}
            >
              <SelectTrigger className="h-8 w-full sm:w-56">
                <SelectValue>
                  {(valor: unknown) =>
                    valor === TODOS_LOS_CAJEROS
                      ? t("reports.history.allCashiers")
                      : cajeros.find((c) => c.user_id === valor)?.etiqueta ??
                        t("reports.history.allCashiers")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_LOS_CAJEROS}>
                  {t("reports.history.allCashiers")}
                </SelectItem>
                {cajeros.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">{cuerpo}</CardContent>

        {/* La paginación la hace el servidor: con meses de ventas, traerlas
            todas al navegador del comerciante lo dejaría inservible. */}
        {!cargando && total > 25 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {t("reports.history.range", { desde, hasta, total })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={pagina === 0}
                onClick={() => irAPagina(pagina - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="tabular-nums">
                {pagina + 1} / {totalPaginas}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => irAPagina(pagina + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <SaleDetailDialog
        ventaId={ventaAbierta}
        onOpenChange={(open) => !open && setVentaAbierta(null)}
      />
    </>
  );
}
