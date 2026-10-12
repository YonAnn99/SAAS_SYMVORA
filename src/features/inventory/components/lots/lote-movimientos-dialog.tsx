"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  fetchMovimientosLote,
  type LoteConExistencias,
  type MovimientoLote,
} from "../../services/lot-service";
import { ETIQUETA_MOVIMIENTO_LOTE } from "../../lotes";
import { BadgeCaducidad } from "./lots-table";

/** Kardex del lote: de donde vino, a donde se fue y cuanto queda en cada sucursal. */
export function LoteMovimientosDialog({
  lote,
  onOpenChange,
  nombreProducto,
  nombreSucursal,
}: {
  lote: LoteConExistencias | null;
  onOpenChange: (open: boolean) => void;
  nombreProducto: string;
  nombreSucursal: (id: string) => string;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoLote[] | null>(null);
  const [error, setError] = useState(false);
  const loteId = lote?.id ?? null;

  useEffect(() => {
    if (!loteId) return;
    let vigente = true;
    const timeout = window.setTimeout(() => {
      setMovimientos(null);
      setError(false);
      fetchMovimientosLote(loteId)
        .then((m) => vigente && setMovimientos(m))
        .catch(() => vigente && setError(true));
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(timeout);
    };
  }, [loteId]);

  const existencias = (lote?.existencias_lote ?? []).filter((e) => Number(e.cantidad) > 0);

  return (
    <Dialog open={Boolean(lote)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Lote {lote?.numero_lote}</DialogTitle>
          <DialogDescription className="text-xs">{nombreProducto}</DialogDescription>
        </DialogHeader>

        {lote && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Caducidad:</span>
              <span>
                {lote.fecha_caducidad
                  ? new Date(`${lote.fecha_caducidad}T12:00:00`).toLocaleDateString("es-MX")
                  : "Sin fecha"}
              </span>
              <BadgeCaducidad fecha={lote.fecha_caducidad} />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium">Dónde está</p>
              {existencias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Agotado en todas las sucursales.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {existencias.map((e) => (
                    <li key={e.sucursal_id} className="flex justify-between px-3 py-1.5">
                      <span>{nombreSucursal(e.sucursal_id)}</span>
                      <span className="font-mono">{Number(e.cantidad)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium">Movimientos</p>
              {error ? (
                <p className="text-xs text-destructive">No se pudieron cargar los movimientos.</p>
              ) : movimientos === null ? (
                <p className="text-xs text-muted-foreground">Cargando…</p>
              ) : movimientos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {movimientos.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{ETIQUETA_MOVIMIENTO_LOTE[m.tipo] ?? m.tipo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {nombreSucursal(m.sucursal_id)} ·{" "}
                          {new Date(m.creado_en).toLocaleString("es-MX", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {m.venta_id && ` · Venta #${m.venta_id.slice(0, 8)}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-mono",
                          Number(m.cantidad) > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        )}
                      >
                        {Number(m.cantidad) > 0 ? "+" : ""}
                        {Number(m.cantidad)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
