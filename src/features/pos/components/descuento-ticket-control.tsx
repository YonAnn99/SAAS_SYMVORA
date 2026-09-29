"use client";

/**
 * La línea "Descuento" del carrito: agregar, ver y quitar un descuento manual
 * a toda la compra, en porcentaje o en monto fijo.
 *
 * Lee y escribe el store directamente (como `usePosCart`, único consumidor
 * del carrito): así no hay que pasar el descuento por la página y el panel de
 * cobro. El reparto entre renglones lo hace `usePosCart`.
 */

import { useState } from "react";
import { BadgePercent, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useCartStore } from "../stores/cart";
import {
  TOPE_DESCUENTO_CAJERO_PCT,
  etiquetaDescuento,
  validarDescuento,
  type TipoDescuento,
} from "../descuento-ticket";

export function DescuentoTicketControl({
  subtotal,
  monto,
}: {
  /** Subtotal antes del descuento y del IVA. */
  subtotal: number;
  /** Lo que se está descontando ahora, ya repartido. */
  monto: number;
}) {
  const descuento = useCartStore((s) => s.descuentoTicket);
  const setDescuento = useCartStore((s) => s.setDescuentoTicket);
  const { can } = usePermissions();
  // Dueño y administradores sin límite; el cajero hasta el 10 %. El servidor
  // lo vuelve a validar: esto solo decide qué se deja escribir.
  const tope = can("sales.discount_unlimited") ? null : TOPE_DESCUENTO_CAJERO_PCT;

  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoDescuento>("porcentaje");
  const [valor, setValor] = useState("");

  const aplicar = () => {
    const propuesto = { tipo, valor: parseFloat(valor) || 0 };
    const error = validarDescuento(propuesto, subtotal, tope);
    if (error) {
      toast.error(error);
      return;
    }
    setDescuento(propuesto);
    setAbierto(false);
    setValor("");
  };

  if (descuento && monto > 0) {
    return (
      <div className="flex items-center justify-between text-xs text-destructive">
        <span className="flex items-center gap-1">
          <BadgePercent className="h-3.5 w-3.5" />
          {etiquetaDescuento(descuento)}
          <button
            type="button"
            onClick={() => setDescuento(null)}
            aria-label="Quitar descuento"
            title="Quitar descuento"
            className="ml-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
        <span className="font-mono">-${monto.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          />
        }
      >
        <BadgePercent className="h-3.5 w-3.5" />
        Agregar descuento
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 space-y-3 p-3">
        <p className="text-sm font-medium">Descuento a la compra</p>
        {/* % o $: segmentado, igual que el selector Agrupado/Desglosado. */}
        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
          {(["porcentaje", "monto"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                tipo === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "porcentaje" ? "Porcentaje %" : "Monto fijo $"}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {tipo === "porcentaje" ? "%" : "$"}
          </span>
          <Input
            autoFocus
            type="number"
            inputMode="decimal"
            min="0"
            step={tipo === "porcentaje" ? "1" : "0.01"}
            placeholder={tipo === "porcentaje" ? "10" : "50.00"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aplicar()}
            className="h-8 pl-7 font-mono text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        {tope !== null && (
          <p className="text-[11px] text-muted-foreground">
            Máximo {tope} % del ticket.
          </p>
        )}
        <Button size="sm" className="h-8 w-full" onClick={aplicar}>
          Aplicar descuento
        </Button>
      </PopoverContent>
    </Popover>
  );
}
