"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { normalizarInsumos, type InsumoLinea } from "@/features/inventory/insumos";
import { descomponerValor, type OpcionCompra } from "@/features/inventory/purchase-order-items";
import { fetchOpcionesInsumo } from "@/features/inventory/services/insumos-service";
import type { CartItem } from "../types/pos.types";

/**
 * Ajustar los insumos de un servicio para ESTA venta (migracion 117): la dosis
 * segun el peso de la mascota, un medicamento extra, quitar lo que no se uso.
 * Las cantidades son el TOTAL de la linea. "Usar la receta" vuelve a la lista
 * configurada en el servicio.
 */
export function InsumosVentaDialog({
  item,
  insumos,
  tenantId,
  onGuardar,
  onClose,
}: {
  item: CartItem | null;
  /** Lo que usaria hoy la linea (ajuste previo o receta × cantidad). */
  insumos: InsumoLinea[] | null;
  tenantId: string | null;
  onGuardar: (insumos: InsumoLinea[] | null) => void;
  onClose: () => void;
}) {
  const [filas, setFilas] = useState<InsumoLinea[]>([]);
  const [opciones, setOpciones] = useState<OpcionCompra[]>([]);
  const abierto = Boolean(item);

  useEffect(() => {
    if (!abierto) return;
    const t0 = window.setTimeout(() => setFilas(insumos ?? []), 0);
    return () => window.clearTimeout(t0);
  }, [abierto, insumos]);

  useEffect(() => {
    if (!abierto || !tenantId || opciones.length > 0) return;
    let vigente = true;
    fetchOpcionesInsumo(tenantId)
      .then((o) => vigente && setOpciones(o))
      .catch(() => vigente && toast.error("No se pudo cargar el catálogo de insumos"));
    return () => {
      vigente = false;
    };
  }, [abierto, tenantId, opciones.length]);

  const elegidos = useMemo(
    () => new Set(filas.map((f) => `${f.productId}::${f.varianteId ?? ""}`)),
    [filas]
  );
  const disponibles = useMemo(
    () => opciones.filter((o) => !elegidos.has(`${o.productoId}::${o.varianteId ?? ""}`)),
    [opciones, elegidos]
  );

  const agregar = (valor: string) => {
    const { productoId, varianteId } = descomponerValor(valor);
    const op = opciones.find((o) => o.value === valor);
    if (!op) return;
    setFilas((prev) => [...prev, { productId: productoId, varianteId, cantidad: 1, nombre: op.label }]);
  };

  const guardar = () => {
    if (filas.some((f) => !(Number(f.cantidad) >= 0))) {
      toast.error("Revisa las cantidades");
      return;
    }
    onGuardar(normalizarInsumos(filas));
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Insumos de esta venta</DialogTitle>
          <DialogDescription className="text-xs">
            {item?.nombre}
            {item && item.cantidad !== 1 ? ` ×${item.cantidad}` : ""}: cantidades totales que se
            descontarán del inventario al cobrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {filas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Esta venta no descontará insumos.</p>
          ) : (
            <ul className="space-y-1.5">
              {filas.map((f, i) => (
                <li key={`${f.productId}-${f.varianteId ?? ""}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{f.nombre}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    aria-label={`Cantidad de ${f.nombre}`}
                    value={Number.isFinite(f.cantidad) ? String(f.cantidad) : ""}
                    onChange={(e) =>
                      setFilas((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, cantidad: Number(e.target.value) } : x))
                      )
                    }
                    className="h-9 w-24 text-right font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label={`Quitar ${f.nombre}`}
                    onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Combobox
            items={disponibles}
            value={null}
            onValueChange={(v) => v && agregar(v as string)}
            itemToStringLabel={(v) => opciones.find((o) => o.value === v)?.label ?? ""}
            filter={(candidato, query) =>
              (candidato as unknown as OpcionCompra).keywords.toLowerCase().includes(query.toLowerCase())
            }
          >
            <ComboboxInputGroup className="h-9 w-full">
              <ComboboxInput placeholder="Agregar insumo…" />
              <ComboboxTrigger />
            </ComboboxInputGroup>
            <ComboboxPortal>
              <ComboboxPositioner>
                <ComboboxPopup className="min-w-64">
                  <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                  <ComboboxList>
                    {(o: OpcionCompra) => (
                      <ComboboxItem key={o.value} value={o.value}>
                        <ComboboxItemIndicator />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </ComboboxPositioner>
            </ComboboxPortal>
          </Combobox>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {item?.insumos ? (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => onGuardar(null)}>
              Usar la receta
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-9" onClick={guardar}>
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
