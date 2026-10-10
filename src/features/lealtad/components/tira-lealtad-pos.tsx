"use client";

import { Gift, Stamp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { progreso } from "../lealtad";
import type { TarjetaConCliente } from "../lealtad-service";
import type { ProgramaLealtad } from "../types";

/**
 * Tarjeta de lealtad adjunta a la venta, bajo el selector de cliente del POS:
 * sellos con barra y, si ya completo, el boton para canjear el premio.
 */
export function TiraLealtadPos({
  tarjeta,
  programa,
  canjear,
  onCanjear,
  onQuitar,
  conTerminal,
  faltaProducto,
  onAgregarProductoPremio,
  totalVenta,
}: {
  tarjeta: TarjetaConCliente;
  programa: ProgramaLealtad;
  canjear: boolean;
  onCanjear: (canjear: boolean) => void;
  onQuitar: () => void;
  /** Cobro con «Tarjeta (terminal)»: la lealtad no aplica (se confirma sin sesion). */
  conTerminal: boolean;
  /** Premio de producto que no esta en el carrito. */
  faltaProducto: boolean;
  onAgregarProductoPremio?: () => void;
  /** Total de esta venta (con IVA y descuentos), para decir si alcanza la compra minima. */
  totalVenta: number;
}) {
  const p = progreso(tarjeta.sellos, programa.sellos_meta);
  const tienePremio = p.premiosDisponibles > 0;
  // Misma regla que el servidor: el TOTAL de la venta contra la compra minima.
  const minima = Number(programa.compra_minima) || 0;
  const faltaParaSello = Math.round((minima - totalVenta) * 100) / 100;

  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <Stamp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">Lealtad · {tarjeta.cliente?.nombre ?? "Cliente"}</span>
            <span className="shrink-0 font-mono">
              {tarjeta.sellos}/{programa.sellos_meta}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Quitar tarjeta de lealtad"
          title="Quitar tarjeta"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {conTerminal ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          La lealtad no aplica al cobrar con terminal: usa otro método para sumar el sello.
        </p>
      ) : tienePremio ? (
        <div className="mt-2 flex items-center gap-2">
          <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-xs">
            {canjear ? "Premio aplicado: " : "Tiene premio: "}
            <span className="font-medium">{programa.premio_descripcion}</span>
          </p>
          {canjear ? (
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onCanjear(false)}>
              Quitar
            </Button>
          ) : faltaProducto && onAgregarProductoPremio ? (
            <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={onAgregarProductoPremio}>
              Agregar y aplicar
            </Button>
          ) : (
            <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={() => onCanjear(true)}>
              Aplicar
            </Button>
          )}
        </div>
      ) : (
        minima > 0 && faltaParaSello > 0 ? (
          <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            Faltan ${faltaParaSello.toFixed(2)} para sumar sello (compra mínima ${minima.toFixed(2)}).
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            ✓ Esta compra suma 1 sello.
          </p>
        )
      )}
    </div>
  );
}
