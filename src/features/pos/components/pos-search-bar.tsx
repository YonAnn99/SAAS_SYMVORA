"use client";

import { useTranslations } from "next-intl";
import { Heart, Layers, LayoutGrid, Search, Tag } from "lucide-react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Valor del desplegable cuando no hay lista elegida: precios normales. */
export const SIN_LISTA = "none";

export type PosViewMode = "grouped" | "unbundled";

export interface OpcionListaPrecios {
  id: string;
  nombre: string;
}

interface PosSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  favoritosCount?: number;
  viewMode: PosViewMode;
  onViewModeChange: (mode: PosViewMode) => void;
  onSearchSubmit: () => void;
  priceLists: OpcionListaPrecios[];
  /** `SIN_LISTA` o el id de la lista elegida. */
  selectedPriceList: string;
  onPriceListChange: (value: string) => void;
  /** Selector de sucursal del dueño (ver `PosSucursalSelector`). */
  sucursalSlot?: React.ReactNode;
}

export function PosSearchBar({
  search,
  onSearchChange,
  onKeyDown,
  categories,
  selectedCategory,
  onCategoryChange,
  favoritosCount = 0,
  viewMode,
  onViewModeChange,
  onSearchSubmit,
  priceLists,
  selectedPriceList,
  onPriceListChange,
  sucursalSlot,
}: PosSearchBarProps) {
  const t = useTranslations();

  const showCategorySelect = categories.length > 0 || favoritosCount > 0;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 animate-fade-in-up stagger-1">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("pos.barcodePlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="pl-8 h-9"
        />
      </div>
      {sucursalSlot}
      {showCategorySelect && (
        <Select
          value={selectedCategory}
          onValueChange={(v) => onCategoryChange(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-44 h-9">
            <SelectValue placeholder="Categoría">
              {/* Con render function: evita que @base-ui muestre 'all' crudo al recargar */}
              {(value: unknown) => {
                if (value === "all") return "Todas";
                if (value === "favorites") {
                  return (
                    <span className="flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                      Favoritos ({favoritosCount})
                    </span>
                  );
                }
                return (value as string) || "Categoría";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="favorites">
              <span className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                Favoritos ({favoritosCount})
              </span>
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* Solo aparece si hay listas activas: en un negocio que no las usa
          seria un control muerto ocupando sitio en la barra. */}
      {priceLists.length > 0 && (
        <Select
          value={selectedPriceList}
          onValueChange={(v) => onPriceListChange(v ?? SIN_LISTA)}
        >
          <SelectTrigger
            className={`w-full sm:w-48 h-9 ${
              selectedPriceList !== SIN_LISTA
                ? "border-primary text-primary"
                : ""
            }`}
          >
            <Tag className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Lista de precios">
              {/* Con render function: el SDK solo conoce las etiquetas cuando
                  el desplegable se ha abierto una vez, y sin esto la barra
                  mostraria el UUID crudo al recargar. */}
              {(value: unknown) =>
                value === SIN_LISTA
                  ? "Precios normales"
                  : priceLists.find((l) => l.id === value)?.nombre ??
                    "Lista de precios"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_LISTA}>Precios normales</SelectItem>
            {priceLists.map((lista) => (
              <SelectItem key={lista.id} value={lista.id}>
                {lista.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Selector de modo de vista: Agrupado vs Desglosado */}
      <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange("grouped")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
            viewMode === "grouped"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Vista agrupada: Productos con selector de variantes"
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Agrupado</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("unbundled")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
            viewMode === "unbundled"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Vista desglosada: Cada variante como tarjeta individual"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Desglosado</span>
        </button>
      </div>

      <SpecularActionButton tone="add" className="h-9" onClick={onSearchSubmit}>
        {t("pos.addItem")}
      </SpecularActionButton>
    </div>
  );
}