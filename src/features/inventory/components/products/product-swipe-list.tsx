"use client";

/**
 * El catalogo en celular: una "pastilla" deslizable por producto (Swipe Row de
 * React Bits, `components/ui/swipe-row.tsx`) en lugar de la tabla de 9
 * columnas, que obligaba a desplazarse de lado para ver casi todo.
 *
 *   deslizar a la mitad  -> Eliminar | Editar (abre el dialogo de siempre)
 *   deslizar completo    -> Eliminar
 *   deslizar a la DERECHA -> Archivar (con confirmacion; sin `onArchive`, nada)
 *   tocar                 -> con variantes, su hoja; producto unico, Editar
 *
 * Desde `md` se sigue usando la tabla (con su edicion en linea).
 */

import Image from "next/image";
import { textoContenido } from "@/lib/unidades";
import { useTranslations } from "next-intl";
import {
  COLOR_ARCHIVAR,
  FilaDeslizable,
  TEXTO_PISTA_DESLIZAR,
  TEXTO_PISTA_DESLIZAR_ARCHIVAR,
  noArrastrar,
  usePistaDeslizar,
} from "@/components/ui/fila-deslizable";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive, ChevronRight, Layers } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { Producto } from "../../types/inventory.types";
import { FavoriteButton, StockBadge } from "./product-badges";
import {
  resumenConVariantes,
  type VarianteResumible,
} from "@/features/inventory/resumen-variantes";

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
  /** Sin ella no se ofrece "Archivar" (rol sin `inventory.manage`). */
  onArchive?: (product: Producto) => Promise<boolean>;
  /** Cuantas variantes tiene cada producto (los que no aparecen, ninguna). */
  conteoVariantes?: Record<string, number>;
  /** Tocar un producto con variantes abre su hoja de variantes. */
  onVerVariantes?: (product: Producto) => void;
  /** Para resumir precio, stock y estado de un producto con variantes. */
  variantesPorProducto?: Record<string, VarianteResumible[]>;
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
  onArchive,
  conteoVariantes = {},
  onVerVariantes,
  variantesPorProducto,
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
            {onArchive ? TEXTO_PISTA_DESLIZAR_ARCHIVAR : TEXTO_PISTA_DESLIZAR}
          </span>
        )}
      </div>

      {productos.map((product) => {
        const nVariantes = conteoVariantes[product.id] ?? 0;
        // Producto con variantes: precio, stock y estado salen de ellas.
        const variantesDe = variantesPorProducto?.[product.id];
        const resumen =
          variantesDe && variantesDe.length > 0 ? resumenConVariantes(product, variantesDe) : null;
        return (
          <FilaDeslizable
            key={product.id}
            label={product.nombre}
            onEditar={() => onEdit(product)}
            onEliminar={() => onDelete(product)}
            accionInicio={
              onArchive
                ? {
                    id: "archivar",
                    etiqueta: "Archivar",
                    color: COLOR_ARCHIVAR,
                    icono: <Archive size={18} strokeWidth={2} />,
                    // Pide confirmacion (`handleArchive`); la fila regresa sola.
                    alElegir: () => onArchive(product),
                  }
                : undefined
            }
            onOpenChange={alAbrir}
            // Tocar (sin deslizar): con variantes abre su hoja; un producto
            // unico abre Editar directo, sin tener que deslizar.
            onTap={nVariantes > 0 && onVerVariantes ? () => onVerVariantes(product) : () => onEdit(product)}
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

            {/* Producto con variantes: solo nombre, variantes y stock total. El
                rango de precio aplastaba el nombre hasta desaparecerlo; el
                precio de cada variante se ve en su hoja (tocar la fila). */}
            {resumen ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.nombre}</p>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1e3a8a]/10 px-1.5 py-px text-[10px] font-semibold text-[#1e3a8a] dark:bg-blue-500/15 dark:text-blue-300">
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {nVariantes === 1 ? "1 variante" : `${nVariantes} variantes`}
                  </span>
                  <span
                    className={`truncate ${
                      product.es_servicio
                        ? "text-muted-foreground"
                        : resumen.estado === "agotado"
                          ? "font-medium text-red-600 dark:text-red-400"
                          : resumen.estado === "bajo"
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                    }`}
                  >
                    {product.es_servicio ? "Servicio" : `${resumen.stockTotal} en stock`}
                  </span>
                </div>
              </div>
            ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.nombre}</p>
                {product.descripcion?.trim() && (
                  <p className="truncate text-xs text-muted-foreground">{product.descripcion}</p>
                )}
                <p className="truncate text-xs opacity-60">
                  {t(`products.units.${product.unidad_medida}`)}
                  {textoContenido(product) && ` ${textoContenido(product)}`}
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
            </>
            )}

            <span onPointerDown={noArrastrar} className="-mr-2 flex shrink-0 items-center">
              <FavoriteButton
                esFavorito={favoritos.has(product.id)}
                onToggle={() => onToggleFavorito(product)}
                nombre={product.nombre}
              />
            </span>
            {nVariantes > 0 && (
              <ChevronRight className="-mr-1 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            )}
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
