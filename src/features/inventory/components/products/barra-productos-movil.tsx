"use client";

/**
 * Busqueda y filtros del catalogo en celular, en dos renglones que caben:
 *
 *   [Buscar producto...        ] [Filtros] [CSV] [PDF]
 *   [Stock bajo x  Favoritos x                    ]   <- Multi Select de beUI
 *
 * La barra de escritorio ponia todo en un renglon de ~970 px que no se partia
 * y desbordaba la pantalla. Los filtros son el mismo `ProductFilters` de los
 * chips y del dialogo (ver `filtros-etiquetas.ts`), asi que todo cuadra.
 */

import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectGroup,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectLabel,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/motion/multi-select";
import {
  SIN_CATEGORIA,
  STOCK_STATUS_LABEL,
  type ProductFilters,
  type StockStatus,
} from "@/features/inventory/stock-status";
import {
  ETIQUETA_FAVORITOS,
  ETIQUETA_SIN_MINIMO,
  etiquetaCategoria,
  etiquetaStock,
  etiquetasAFiltros,
  filtrosAEtiquetas,
} from "@/features/inventory/filtros-etiquetas";

interface BarraProductosMovilProps {
  search: string;
  onSearchChange: (texto: string) => void;
  filters: ProductFilters;
  onFiltersChange: (filtros: ProductFilters) => void;
  activeFilterCount: number;
  onAbrirFiltros: () => void;
  /** Conteos sobre el catalogo completo, como los chips. */
  stockCounts: Record<StockStatus, number>;
  sinMinimoCount: number;
  favoritosCount: number;
  categories: string[];
  sinCategoriaCount: number;
  placeholderBusqueda: string;
  /** CSV/PDF (`DataTableToolbar`): en pantalla chica ya va solo con icono. */
  exportar: ReactNode;
}

function Opcion({
  value,
  label,
  conteo,
}: {
  value: string;
  label: string;
  conteo?: number;
}) {
  return (
    <MultiSelectItem value={value} textValue={label}>
      <span className="flex items-center justify-between gap-3">
        <span className="truncate">{label}</span>
        {conteo !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">{conteo}</span>
        )}
      </span>
    </MultiSelectItem>
  );
}

export function BarraProductosMovil({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  activeFilterCount,
  onAbrirFiltros,
  stockCounts,
  sinMinimoCount,
  favoritosCount,
  categories,
  sinCategoriaCount,
  placeholderBusqueda,
  exportar,
}: BarraProductosMovilProps) {
  const etiquetas = filtrosAEtiquetas(filters);

  return (
    <div className="space-y-2 md:hidden">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={placeholderBusqueda}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8 pr-9 text-sm"
          />
          <BotonEscanear modo="uno" titulo="Buscar por código" onCodigo={onSearchChange} />
        </div>
        {/* El contador va FUERA del boton: el llenado (`.btn-llenado`) recorta lo
            que sobresale y el circulo quedaba cortado. */}
        <div className="relative shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onAbrirFiltros}
            aria-label="Filtros y orden"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          {activeFilterCount > 0 && (
            <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-medium leading-4 text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="shrink-0">{exportar}</div>
      </div>

      <MultiSelect
        value={etiquetas}
        onValueChange={(siguientes) =>
          onFiltersChange(etiquetasAFiltros(siguientes, filters, etiquetas))
        }
      >
        <MultiSelectTrigger className="min-w-0">
          {/* Un solo texto de ayuda: el del campo, que se ve mientras no hay
              etiquetas (abierto o cerrado). Con los dos se encimaban. */}
          <MultiSelectValue placeholder="" />
          <MultiSelectInput
            aria-label="Buscar filtro"
            placeholder="Filtrar: stock, favoritos, categoría…"
            // El anillo de foco global (`:focus-visible` en globals.css) le
            // dibujaba un marco propio DENTRO del recuadro, que ya marca el foco.
            className="focus-visible:shadow-none!"
          />
        </MultiSelectTrigger>
        <MultiSelectContent>
          <MultiSelectList ariaLabel="Filtros">
            <MultiSelectGroup>
              <MultiSelectLabel>Rápidos</MultiSelectLabel>
              <Opcion value={etiquetaStock("bajo")} label="Stock bajo" conteo={stockCounts.bajo} />
              <Opcion value={ETIQUETA_SIN_MINIMO} label="Stock indefinido" conteo={sinMinimoCount} />
              <Opcion value={ETIQUETA_FAVORITOS} label="Favoritos" conteo={favoritosCount} />
            </MultiSelectGroup>
            <MultiSelectGroup>
              <MultiSelectLabel>Estado</MultiSelectLabel>
              {(["ok", "agotado", "servicio"] as const).map((estado) => (
                <Opcion
                  key={estado}
                  value={etiquetaStock(estado)}
                  label={STOCK_STATUS_LABEL[estado]}
                  conteo={stockCounts[estado]}
                />
              ))}
            </MultiSelectGroup>
            {(categories.length > 0 || sinCategoriaCount > 0) && (
              <MultiSelectGroup>
                <MultiSelectLabel>Categoría (una)</MultiSelectLabel>
                {categories.map((c) => (
                  <Opcion key={c} value={etiquetaCategoria(c)} label={c} />
                ))}
                {sinCategoriaCount > 0 && (
                  <Opcion
                    value={etiquetaCategoria(SIN_CATEGORIA)}
                    label="Sin categoría"
                    conteo={sinCategoriaCount}
                  />
                )}
              </MultiSelectGroup>
            )}
            <MultiSelectEmpty>Sin filtros con ese nombre.</MultiSelectEmpty>
          </MultiSelectList>
        </MultiSelectContent>
      </MultiSelect>
    </div>
  );
}
