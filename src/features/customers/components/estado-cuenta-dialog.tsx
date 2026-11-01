"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, HandCoins, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMXN } from "@/lib/money";
import { clavePagoI18n, numeroOperacion } from "@/features/pos/ticket-format";
import { SaleDetailDialog, EstadoVentaBadge } from "@/features/sales/components/sale-detail-dialog";
import type { Cliente } from "@/lib/types/database";
import { fetchEstadoCuenta } from "../services/customer-service";
import { movimientosDeCuenta, type EstadoCuenta } from "../estado-cuenta";

interface EstadoCuentaDialogProps {
  /** Cliente a mostrar, o `null` para cerrar. */
  cliente: Cliente | null;
  onOpenChange: (open: boolean) => void;
  /** «Registrar abono»: la pagina cierra esta ventana y abre la de abono. */
  onAbonar: (cliente: Cliente) => void;
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Estado de cuenta de un cliente (migracion 129): lo que debe y de donde viene.
 * Sus ventas a credito (al tocar una se abre el mismo detalle del Historial,
 * con productos y reimpresion) y sus abonos, en una sola lista por fecha.
 *
 * Nacio de una sugerencia real: «si mi cliente me debe $2,000, ¿como reviso el
 * ticket de lo que me debe?». Las ventas siguen la regla del Historial: sin
 * `sales.view_all` solo se ven las propias, y se avisa.
 */
export function EstadoCuentaDialog({ cliente, onOpenChange, onAbonar }: EstadoCuentaDialogProps) {
  const t = useTranslations();
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ventaAbierta, setVentaAbierta] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente) return;
    let cancelado = false;
    // Al abrir, se limpia lo del cliente anterior y se vuelve a consultar.
    queueMicrotask(() => {
      if (cancelado) return;
      setEstado(null);
      setError(null);
    });
    fetchEstadoCuenta(cliente.id)
      .then((e) => !cancelado && setEstado(e))
      .catch(() => !cancelado && setError("No se pudo cargar el estado de cuenta."));
    return () => {
      cancelado = true;
    };
  }, [cliente]);

  const movimientos = useMemo(() => (estado ? movimientosDeCuenta(estado) : []), [estado]);
  const saldo = estado?.cliente.saldo_pendiente ?? cliente?.saldo_pendiente ?? 0;

  return (
    <>
      <Dialog open={!!cliente} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" aria-hidden />
              Estado de cuenta
            </DialogTitle>
            <DialogDescription>{cliente?.nombre}</DialogDescription>
          </DialogHeader>

          <div className="flex items-end justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Debe</p>
              <p className={cn("text-2xl font-bold tabular-nums", saldo > 0 && "text-red-600 dark:text-red-400")}>
                {formatMXN(saldo)}
              </p>
            </div>
            {estado && estado.cliente.limite_credito > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                Límite de crédito
                <br />
                <span className="font-medium text-foreground tabular-nums">
                  {formatMXN(estado.cliente.limite_credito)}
                </span>
              </p>
            )}
          </div>

          {estado?.ventas_parciales && (
            <p className="text-[11px] text-muted-foreground">
              Solo ves las ventas a crédito que registraste tú. El saldo sí es el total del cliente.
            </p>
          )}

          <div className="max-h-[50dvh] overflow-y-auto">
            {!estado && !error && (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando…
              </p>
            )}
            {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}
            {estado && movimientos.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Este cliente no tiene ventas a crédito ni abonos.
              </p>
            )}
            <ul className="divide-y divide-border">
              {movimientos.map((m) =>
                m.tipo === "venta" ? (
                  <li key={`v-${m.venta.id}`}>
                    <button
                      type="button"
                      onClick={() => setVentaAbierta(m.venta.id)}
                      className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        <Receipt className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          Venta #{numeroOperacion(m.venta.id)}
                          <EstadoVentaBadge estado={m.venta.estado} />
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {fechaCorta(m.fecha)}
                          {m.venta.cajero ? ` · ${m.venta.cajero}` : ""}
                          {m.venta.sucursal ? ` · ${m.venta.sucursal}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          m.venta.estado === "COMPLETADA" ? "text-foreground" : "text-muted-foreground line-through"
                        )}
                      >
                        +{formatMXN(m.venta.total)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ) : (
                  <li key={`a-${m.abono.id}`} className="flex items-center gap-3 px-1 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <HandCoins className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        Abono · {t(clavePagoI18n(m.abono.metodo_pago))}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {fechaCorta(m.fecha)}
                        {m.abono.registro ? ` · ${m.abono.registro}` : ""}
                        {m.abono.notas ? ` · ${m.abono.notas}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      −{formatMXN(m.abono.monto)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {cliente && saldo > 0 && (
              <Button onClick={() => onAbonar(cliente)}>
                <HandCoins className="mr-1.5 h-4 w-4" aria-hidden />
                Registrar abono
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaleDetailDialog ventaId={ventaAbierta} onOpenChange={(abierta) => !abierta && setVentaAbierta(null)} />
    </>
  );
}
