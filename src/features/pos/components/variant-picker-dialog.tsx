"use client";

/**
 * Selector de variante al agregar un producto al carrito.
 *
 * Solo aparece si el producto TIENE variantes registradas. Un producto marcado
 * como "permite variantes" pero sin ninguna creada se vende directo, sin
 * diálogo — si no, quedaría invendible.
 *
 * Cada opción muestra SU precio y SU stock porque son independientes: la
 * variante tiene su propio anaquel, y el producto conserva un stock "sin
 * clasificar" del que salen las ventas generales.
 */

import { Package, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Producto } from "@/lib/types/database";
import type { VarianteProducto } from "@/features/pos/types/pos.types";

interface VariantPickerDialogProps {
  product: Producto | null;
  variants: VarianteProducto[];
  onOpenChange: (open: boolean) => void;
  onSelect: (variant: VarianteProducto | null) => void;
}

export function variantLabel(v: VarianteProducto): string {
  return [v.talla, v.color].filter(Boolean).join(" · ") || "Variante";
}

/** Precio efectivo: 0 en la variante significa "usa el del producto". */
export function variantPrice(v: VarianteProducto, product: Producto): number {
  return v.precio_venta > 0 ? v.precio_venta : product.precio_venta;
}

export function VariantPickerDialog({
  product,
  variants,
  onOpenChange,
  onSelect,
}: VariantPickerDialogProps) {
  if (!product) return null;

  const sinClasificar = Number(product.stock_actual);

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.nombre}</DialogTitle>
          <DialogDescription>
            Este producto tiene variantes. Elige cuál vas a vender.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {variants.map((v) => {
            const stock = Number(v.stock_actual);
            const agotado = stock <= 0;
            return (
              <button
                key={v.id}
                type="button"
                disabled={agotado}
                onClick={() => onSelect(v)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {variantLabel(v)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm">
                    ${variantPrice(v, product).toFixed(2)}
                  </span>
                  <span
                    className={`block text-xs ${agotado ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {agotado ? "Agotado" : `${stock} disponibles`}
                  </span>
                </span>
              </button>
            );
          })}

          {/* Venta "general": del stock sin clasificar. Se oculta si no queda,
              para no ofrecer algo que el servidor va a rechazar. */}
          {sinClasificar > 0 && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  Producto general
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    sin clasificar
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm">
                  ${Number(product.precio_venta).toFixed(2)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {sinClasificar} disponibles
                </span>
              </span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
