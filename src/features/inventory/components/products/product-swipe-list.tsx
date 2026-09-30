"use client";

/**
 * El catalogo en celular: una "pastilla" deslizable por producto (Swipe Row de
 * React Bits, `components/ui/swipe-row.tsx`) en lugar de la tabla de 9
 * columnas, que obligaba a desplazarse de lado para ver casi todo.
 *
 *   deslizar a la mitad  -> Eliminar | Editar (abre el dialogo de siempre)
 *   deslizar completo    -> Eliminar
 *
 * Desde `md` se sigue usando la tabla (con su edicion en linea).
 */

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  FilaDeslizable,
  TEXTO_PISTA_DESLIZAR,
  noArrastrar,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { Checkbox } from "@/components/ui/checkbox";
import { getInitials } from "@/lib/utils";
import type { Producto } from "../../types/inventory.types";
import { FavoriteButton, StockBadge } from "./product-badges";

interface ProductSwipeListProps {
  productos: Producto[];
  seleccionados: ReadonlySet<string>;
  onToggleSeleccion: (id: string) => void;
  onSeleccionarVisibles: (marcar: boolean) => void;
  todosVisibles: boolean;
  algunosVisibles: boolean;
  favoritos: ReadonlySet<string>;
  onToggleFavorito: (product: Producto) => void;
  onEdit: (product: Producto) => void;
  /** `false` si no se pudo borrar: la fila reaparece. */
  onDelete: (product: Producto) => void | Promise<boolean | void>;
}

export function ProductSwipeList({
  productos,
  seleccionados,
  onToggleSeleccion,
  onSeleccionarVisibles,
  todosVisibles,
  algunosVisibles,
  favoritos,
  onToggleFavorito,
  onEdit,
  onDelete,
}: ProductSwipeListProps) {
  const t = useTranslations();
  const { verPista, alAbrir } = usePistaDeslizar();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={todosVisibles}
            indeterminate={algunosVisibles}
            onCheckedChange={() => onSeleccionarVisibles(!todosVisibles)}
            aria-label="Seleccionar todos los productos visibles"
          />
          Seleccionar todos
        </label>
        {verPista && (
          <span className="text-[11px] text-muted-foreground">
            {TEXTO_PISTA_DESLIZAR}
          </span>
        )}
      </div>

      {productos.map((product) => (
          <FilaDeslizable
            key={product.id}
            label={product.nombre}
            onEditar={() => onEdit(product)}
            onEliminar={() => onDelete(product)}
            onOpenChange={alAbrir}
          >
            <span onPointerDown={noArrastrar} className="flex shrink-0 items-center">
              <Checkbox
                checked={seleccionados.has(product.id)}
                onCheckedChange={() => onToggleSeleccion(product.id)}
                aria-label={`Seleccionar ${product.nombre}`}
              />
            </span>

            {product.imagen_url ? (
              <Image
                src={product.imagen_url}
                alt=""
                width={36}
                height={36}
                draggable={false}
                className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
                {getInitials(product.nombre)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.nombre}</p>
              <p className="truncate text-xs opacity-60">
                {t(`products.units.${product.unidad_medida}`)}
                {" · "}
                {product.es_servicio ? "Servicio" : `${product.stock_actual} en stock`}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm tabular-nums">
                ${product.precio_venta.toFixed(2)}
              </span>
              <StockBadge product={product} />
            </div>

            <span onPointerDown={noArrastrar} className="-mr-2 flex shrink-0 items-center">
              <FavoriteButton
                esFavorito={favoritos.has(product.id)}
                onToggle={() => onToggleFavorito(product)}
                nombre={product.nombre}
              />
            </span>
          </FilaDeslizable>
      ))}
    </div>
  );
}
