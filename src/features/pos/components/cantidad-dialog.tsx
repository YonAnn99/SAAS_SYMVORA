"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { abreviatura, formatearCantidad, normalizarCantidad } from "@/lib/unidades";

/**
 * "¿Cuánto?" para productos que se venden por medida (kg, g, l, ml, m).
 *
 * Antes el POS solo sumaba de 1 en 1: no habia forma de cobrar 0.750 kg de
 * jitomate ni 3.5 m de cable, aunque la base guarda 3 decimales. Se abre al
 * agregar un producto fraccionable; muestra el importe mientras se escribe.
 */

/** Atajos segun la unidad: fracciones para kilo/litro/metro, cantidades redondas para g/ml. */
function atajos(unidad: string): number[] {
  return unidad === "GRAMO" || unidad === "MILILITRO" ? [100, 250, 500, 1000] : [0.25, 0.5, 1, 2];
}

function etiquetaAtajo(n: number): string {
  if (n === 0.25) return "¼";
  if (n === 0.5) return "½";
  return String(n);
}

export function CantidadDialog({
  open,
  nombre,
  unidad,
  precioUnitario,
  disponible,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  nombre: string;
  unidad: string;
  precioUnitario: number;
  /** Existencias en la sucursal; `null` si no aplica (servicio). */
  disponible: number | null;
  onConfirm: (cantidad: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cada apertura empieza vacia y con el foco en el campo (el cajero teclea
  // directo lo que marca la bascula). Diferido: setState sincrono en el efecto
  // lo marca el linter de React.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setValor("");
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const cantidad = normalizarCantidad(valor, unidad);
  const excede = cantidad !== null && disponible !== null && cantidad > disponible;
  const valida = cantidad !== null && !excede;

  const confirmar = (n: number | null = cantidad) => {
    if (n === null) return;
    if (disponible !== null && n > disponible) return;
    onConfirm(n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">¿Cuánto?</DialogTitle>
          <DialogDescription className="text-xs">
            {nombre} · ${precioUnitario.toFixed(2)} por {abreviatura(unidad, 1)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              inputMode="decimal"
              placeholder="0.000"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-label={`Cantidad en ${abreviatura(unidad)}`}
              className="h-11 text-lg font-mono"
            />
            <span className="text-sm font-medium text-muted-foreground w-10">{abreviatura(unidad)}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {atajos(unidad).map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                disabled={disponible !== null && n > disponible}
                onClick={() => confirmar(n)}
              >
                {etiquetaAtajo(n)} {abreviatura(unidad, n)}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Importe</span>
            <span className="font-mono font-semibold">
              ${((cantidad ?? 0) * precioUnitario).toFixed(2)}
            </span>
          </div>

          {excede && (
            <p className="text-xs text-destructive">
              Solo hay {formatearCantidad(disponible ?? 0, unidad)} en esta sucursal.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!valida}>
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
