"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TrendingDown, TrendingUp } from "lucide-react";
import { aplicarPorcentaje, type Direccion } from "../../price-list";

/**
 * Sube o baja de golpe el precio de las filas seleccionadas.
 *
 * Es la razón de ser de toda la pantalla: sin esto habría que editar producto
 * por producto, que es justo lo que se quería evitar.
 */

interface BulkPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuántas filas se van a tocar. */
  cuantas: number;
  saving: boolean;
  onApply: (
    porcentaje: number,
    direccion: Direccion,
    redondear: boolean
  ) => void;
}

const ATAJOS = [5, 10, 15, 20];

export function BulkPriceDialog({
  open,
  onOpenChange,
  cuantas,
  saving,
  onApply,
}: BulkPriceDialogProps) {
  const [direccion, setDireccion] = useState<Direccion>("aumentar");
  const [porcentaje, setPorcentaje] = useState("10");
  const [redondear, setRedondear] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setDireccion("aumentar");
      setPorcentaje("10");
      setRedondear(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // Se valida con la misma función que hará el cálculo, sobre un precio de
  // prueba: así el aviso de error y el resultado no pueden discrepar.
  const prueba = aplicarPorcentaje(100, Number(porcentaje), direccion, redondear);
  const valido = prueba.ok && porcentaje.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Actualiza el precio de esta lista
          </DialogTitle>
          <DialogDescription className="text-xs">
            Se aplica sobre el precio base de cada producto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["aumentar", "Aumentar precio", TrendingUp],
              ["disminuir", "Disminuir precio", TrendingDown],
            ] as const
          ).map(([valor, etiqueta, Icono]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setDireccion(valor)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                direccion === valor
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <Icono className="h-3.5 w-3.5" />
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Porcentaje</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              className="h-8 pr-7 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
          {!valido && !prueba.ok && (
            <p className="text-xs text-destructive">{prueba.error}</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {ATAJOS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPorcentaje(String(v))}
              className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                porcentaje === String(v)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {v}%
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
          <Switch checked={redondear} onCheckedChange={setRedondear} />
          Redondear a números enteros. No usar decimales.
        </label>

        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Aplicaremos {direccion === "aumentar" ? "un aumento" : "un descuento"} del{" "}
          <strong className="text-foreground">{porcentaje || 0}%</strong> sobre los
          precios base de {cuantas} {cuantas === 1 ? "producto" : "productos"}{" "}
          {cuantas === 1 ? "seleccionado" : "seleccionados"}.
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onApply(Number(porcentaje), direccion, redondear)}
            disabled={!valido || saving || cuantas === 0}
          >
            {saving ? "Actualizando..." : "Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
