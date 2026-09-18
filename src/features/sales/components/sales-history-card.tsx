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
import { useTranslations } from "next-intl";
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
import { clavePagoI18n, numeroOperacion } from "@/features/pos/ticket-format";
import { formatMXN } from "@/lib/money";
import type { Periodo } from "@/lib/periodo";
import { useSalesHistory } from "../hooks/use-sales-history";
import { SaleDetailDialog, EstadoVentaBadge } from "./sale-detail-dialog";

const TODOS_LOS_CAJEROS = "todos";

interface SalesHistoryCardProps {
  tenantId: string | null;
  periodo: Periodo;
  fechaElegida: Date | null;
}

interface Cajero {
  user_id: string;
  user_email: string;
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
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
}: SalesHistoryCardProps) {
  const t = useTranslations();
  const { can } = usePermissions();
  const veTodas = can("sales.view_all");

  const [cajeroSel, setCajeroSel] = useState<string>(TODOS_LOS_CAJEROS);
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
  } = useSalesHistory(
    tenantId,
    periodo,
    fechaElegida,
    cajeroSel === TODOS_LOS_CAJEROS ? null : cajeroSel
  );

  // La lista de cajeros solo hace falta si se pueden ver las ventas de otros.
  useEffect(() => {
    if (!tenantId || !veTodas) return;
    const t0 = window.setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.rpc("get_tenant_members", {
        p_tenant_id: tenantId,
      });
      setCajeros(
        ((data ?? []) as Cajero[]).map((m) => ({
          user_id: m.user_id,
          user_email: m.user_email,
        }))
      );
    }, 0);
    return () => window.clearTimeout(t0);
  }, [tenantId, veTodas]);

  const desde = pagina * 25 + 1;
  const hasta = Math.min((pagina + 1) * 25, total);

  const cuerpo = useMemo(() => {
    if (sinFechaElegida) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Elige un día en el calendario para ver sus ventas.
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
            No hay ventas en este periodo
            {!veTodas && " a tu nombre"}.
          </p>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Operación</TableHead>
            {veTodas && <TableHead>Atendió</TableHead>}
            <TableHead>Cliente</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead className="text-right">Total</TableHead>
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
                {horaCorta(v.fecha_venta)}
                {v.origen === "offline" && (
                  <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                    offline
                  </span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">
                #{numeroOperacion(v.id)}
                <EstadoVentaBadge estado={v.estado} />
              </TableCell>
              {veTodas && (
                <TableCell className="max-w-[160px] truncate text-xs">
                  {v.cajero_email ?? "—"}
                </TableCell>
              )}
              <TableCell className="max-w-[140px] truncate text-xs">
                {v.cliente_nombre ?? "Cliente general"}
              </TableCell>
              <TableCell className="text-xs">
                {t(clavePagoI18n(v.metodo_pago))}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatMXN(v.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [sinFechaElegida, cargando, ventas, veTodas, t]);

  return (
    <>
      <Card className="animate-fade-in-up stagger-6">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            Ventas del periodo
            {total > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {total}
              </span>
            )}
          </CardTitle>

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
                      ? "Todos los cajeros"
                      : cajeros.find((c) => c.user_id === valor)?.user_email ??
                        "Todos los cajeros"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_LOS_CAJEROS}>
                  Todos los cajeros
                </SelectItem>
                {cajeros.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.user_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>

        <CardContent className="p-0 sm:p-0">{cuerpo}</CardContent>

        {/* La paginación la hace el servidor: con meses de ventas, traerlas
            todas al navegador del comerciante lo dejaría inservible. */}
        {!cargando && total > 25 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {desde}–{hasta} de {total}
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
