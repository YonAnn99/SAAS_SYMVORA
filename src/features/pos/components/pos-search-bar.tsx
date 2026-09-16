"use client";

import { useTranslations } from "next-intl";
import { Search, Tag } from "lucide-react";
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
  onSearchSubmit: () => void;
  priceLists: OpcionListaPrecios[];
  /** `SIN_LISTA` o el id de la lista elegida. */
  selectedPriceList: string;
  onPriceListChange: (value: string) => void;
}

export function PosSearchBar({
  search,
  onSearchChange,
  onKeyDown,
  categories,
  selectedCategory,
  onCategoryChange,
  onSearchSubmit,
  priceLists,
  selectedPriceList,
  onPriceListChange,
}: PosSearchBarProps) {
  const t = useTranslations();

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
      {categories.length > 0 && (
        <Select
          value={selectedCategory}
          onValueChange={(v) => onCategoryChange(v ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
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

      <SpecularActionButton tone="add" className="h-9" onClick={onSearchSubmit}>
        {t("pos.addItem")}
      </SpecularActionButton>
    </div>
  );
}