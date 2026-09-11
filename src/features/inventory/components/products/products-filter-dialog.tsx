"use client";

/**
 * Filtros y orden del catálogo de productos.
 *
 * Trabaja sobre un BORRADOR local y solo lo vuelca al pulsar "Aplicar". Si
 * cada clic filtrara la tabla de detrás, "Limpiar" no tendría sentido y la
 * lista bailaría mientras se eligen los filtros.
 *
 * Los tres grupos de stock salen de `stockStatus()`, la misma función que pinta
 * la etiqueta de la tabla: así el filtro y la etiqueta no pueden decir cosas
 * distintas del mismo producto.
 */

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  EMPTY_FILTERS,
  SIN_CATEGORIA,
  SORT_LABELS,
  STOCK_STATUS_LABEL,
  type ProductFilters,
  type SortOption,
  type StockStatus,
} from "@/features/inventory/stock-status";

interface ProductsFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  /** Categorías presentes en el catálogo. */
  categories: string[];
  /** Cuántos productos hay en cada grupo de stock. */
  stockCounts: Record<StockStatus, number>;
  /** Cuántos productos no tienen categoría. */
  sinCategoriaCount: number;
}

const STOCK_ORDER: StockStatus[] = ["ok", "bajo", "agotado"];

export function ProductsFilterDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  categories,
  stockCounts,
  sinCategoriaCount,
}: ProductsFilterDialogProps) {
  const [draft, setDraft] = useState<ProductFilters>(filters);
  const [showSort, setShowSort] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Al reabrir se parte de los filtros vigentes, no de lo que quedó a medias
  // en el borrador la vez anterior. Diferido igual que en el resto del
  // proyecto: setState síncrono dentro de un efecto encadena renders
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => setDraft(filters), 0);
    return () => window.clearTimeout(timeout);
  }, [open, filters]);

  const toggleStock = (status: StockStatus) => {
    setDraft((d) => ({
      ...d,
      stock: d.stock.includes(status)
        ? d.stock.filter((s) => s !== status)
        : [...d.stock, status],
    }));
  };

  const categoriaLabel =
    draft.categoria === SIN_CATEGORIA
      ? "Sin categoría"
      : (draft.categoria ?? "Todas las categorías");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>

        {/* Ordenar */}
        <section>
          <button
            type="button"
            onClick={() => setShowSort((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-left"
          >
            <span>
              <span className="block text-sm font-medium">Ordenar</span>
              <span className="block text-xs text-muted-foreground">
                {SORT_LABELS[draft.sort]}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showSort ? "rotate-180" : ""}`}
            />
          </button>

          {showSort && (
            <div className="mt-2 space-y-0.5">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, sort: key }));
                    setShowSort(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  {SORT_LABELS[key]}
                  {draft.sort === key && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Categoría */}
        <section className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowCategories((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-left"
          >
            <span>
              <span className="block text-sm font-medium">Categoría</span>
              <span className="block text-xs text-muted-foreground">
                {categoriaLabel}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showCategories ? "rotate-180" : ""}`}
            />
          </button>

          {showCategories && (
            <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              <CategoryOption
                label="Todas las categorías"
                selected={draft.categoria === null}
                onSelect={() => {
                  setDraft((d) => ({ ...d, categoria: null }));
                  setShowCategories(false);
                }}
              />
              {categories.map((c) => (
                <CategoryOption
                  key={c}
                  label={c}
                  selected={draft.categoria === c}
                  onSelect={() => {
                    setDraft((d) => ({ ...d, categoria: c }));
                    setShowCategories(false);
                  }}
                />
              ))}
              {/* Solo si hay alguno: ofrecer un filtro que devuelve cero
                  resultados es ruido. */}
              {sinCategoriaCount > 0 && (
                <CategoryOption
                  label="Sin categoría"
                  count={sinCategoriaCount}
                  selected={draft.categoria === SIN_CATEGORIA}
                  onSelect={() => {
                    setDraft((d) => ({ ...d, categoria: SIN_CATEGORIA }));
                    setShowCategories(false);
                  }}
                />
              )}
            </div>
          )}
        </section>

        {/* Stock */}
        <section className="border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium">Stock</p>
          <div className="flex flex-wrap gap-2">
            {STOCK_ORDER.map((status) => {
              const active = draft.stock.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStock(status)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {STOCK_STATUS_LABEL[status]}
                  {/* El conteo es lo que convierte esto en un diagnóstico
                      ("tienes 3 por acabarse") y no solo en un filtro. */}
                  <span className="ml-1.5 opacity-60">{stockCounts[status]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={
              draft.stock.length === 0 &&
              draft.categoria === null &&
              draft.sort === EMPTY_FILTERS.sort
            }
          >
            Limpiar
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryOption({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <span className="truncate">
        {label}
        {count !== undefined && (
          <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
        )}
      </span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
