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
import {
  abreviatura,
  cantidadPorImporte,
  formatearCantidad,
  normalizarCantidad,
} from "@/lib/unidades";

/**
 * "¿Cuánto?" para productos que se venden por medida (kg, g, l, ml, m).
 *
 * Antes el POS solo sumaba de 1 en 1: no habia forma de cobrar 0.750 kg de
 * jitomate ni 3.5 m de cable, aunque la base guarda 3 decimales. Se abre al
 * agregar un producto fraccionable; muestra el importe mientras se escribe.
 *
 * Tambien por IMPORTE: "$50 de jamon" -> 0.278 kg. Se agrega la cantidad
 * calculada (con 3 decimales, como guarda la base), asi que el carrito y el
 * servidor no cambian; el importe real puede variar unos centavos.
 */

type Modo = "cantidad" | "importe";

/** Atajos del modo importe, en pesos. */
const ATAJOS_IMPORTE = [20, 50, 100, 200];

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
  const [modo, setModo] = useState<Modo>("cantidad");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cada apertura empieza vacia y con el foco en el campo (el cajero teclea
  // directo lo que marca la bascula). Diferido: setState sincrono en el efecto
  // lo marca el linter de React.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setValor("");
      setModo("cantidad");
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const porImporte = modo === "importe";
  const cantidadDe = (texto: string | number) =>
    porImporte ? cantidadPorImporte(texto, precioUnitario, unidad) : normalizarCantidad(texto, unidad);
  const cantidad = cantidadDe(valor);
  const excede = cantidad !== null && disponible !== null && cantidad > disponible;
  const valida = cantidad !== null && !excede;

  const cambiarModo = (siguiente: Modo) => {
    setModo(siguiente);
    setValor("");
    inputRef.current?.focus();
  };

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

        {/* Cantidad (lo que marca la bascula) o importe ("$50 de jamon"). */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Vender por">
          {(["cantidad", "importe"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => cambiarModo(m)}
              className={`h-7 rounded-md text-xs font-medium transition-colors ${
                modo === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "cantidad" ? `Cantidad (${abreviatura(unidad, 1)})` : "Importe ($)"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            {porImporte && <span className="w-4 text-lg font-medium text-muted-foreground">$</span>}
            <Input
              ref={inputRef}
              inputMode="decimal"
              placeholder={porImporte ? "0.00" : "0.000"}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-label={porImporte ? "Importe en pesos" : `Cantidad en ${abreviatura(unidad)}`}
              className="h-11 text-lg font-mono"
            />
            {!porImporte && (
              <span className="text-sm font-medium text-muted-foreground w-10">{abreviatura(unidad)}</span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {porImporte
              ? ATAJOS_IMPORTE.map((monto) => {
                  const n = cantidadDe(monto);
                  return (
                    <Button
                      key={monto}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={n === null || (disponible !== null && n > disponible)}
                      onClick={() => confirmar(n)}
                    >
                      ${monto}
                    </Button>
                  );
                })
              : atajos(unidad).map((n) => (
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

          {/* En importe se muestra la cantidad que entra y lo que de verdad se
              cobra (la cantidad va con 3 decimales: puede variar centavos). */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{porImporte ? "Se agrega" : "Importe"}</span>
            <span className="font-mono font-semibold">
              {porImporte && cantidad !== null && `${formatearCantidad(cantidad, unidad)} · `}$
              {((cantidad ?? 0) * precioUnitario).toFixed(2)}
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
