"use client";

/**
 * Las variantes en celular: una pastilla deslizable por talla/color en lugar
 * de la tabla de 7 columnas (ver `components/ui/fila-deslizable.tsx`).
 *
 *   deslizar a la mitad  -> Eliminar | Editar (abre el dialogo de siempre)
 *   deslizar completo    -> Eliminar
 */

import {
  FilaDeslizable,
  TEXTO_PISTA_DESLIZAR,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import type { VarianteProducto } from "../../types/inventory.types";

interface VariantSwipeListProps {
  variantes: VarianteProducto[];
  getProductName: (productId: string) => string;
  onEdit: (variant: VarianteProducto) => void;
  /** `false` si no se pudo borrar: la fila reaparece. */
  onDelete: (variant: VarianteProducto) => void | Promise<boolean | void>;
}

export function VariantSwipeList({
  variantes,
  getProductName,
  onEdit,
  onDelete,
}: VariantSwipeListProps) {
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">{TEXTO_PISTA_DESLIZAR}</p>
      )}

      {variantes.map((variant) => {
        const producto = getProductName(variant.producto_id);
        const nombre =
          [variant.talla, variant.color].filter(Boolean).join(" / ") || "Variante";

        return (
          <FilaDeslizable
            key={variant.id}
            label={`${producto} ${nombre}`}
            onEditar={() => onEdit(variant)}
            onEliminar={() => onDelete(variant)}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{producto}</p>
              <p className="flex min-w-0 items-center gap-1.5 text-xs opacity-60">
                {variant.talla && <span className="shrink-0">{variant.talla}</span>}
                {variant.talla && variant.color && <span aria-hidden="true">·</span>}
                {variant.color && (
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border"
                      style={{ backgroundColor: variant.color }}
                    />
                    <span className="truncate">{variant.color}</span>
                  </span>
                )}
                {variant.sku && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate font-mono">{variant.sku}</span>
                  </>
                )}
                {!variant.talla && !variant.color && !variant.sku && <span>Sin talla ni color</span>}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-sm tabular-nums">
                ${variant.precio_venta.toFixed(2)}
              </span>
              <span className="text-xs opacity-60">{variant.stock_actual} en stock</span>
            </div>
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
