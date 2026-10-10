"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Layers, LayoutGrid, QrCode, Search, SlidersHorizontal, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import type { ResultadoEscaneo } from "@/components/escaner/escaner-camara";
import { cn } from "@/lib/utils";
import { PosAjustesHoja } from "./pos-ajustes-hoja";

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
  /** Codigo leido con la camara (modo continuo): agrega y responde. */
  onCodigoCamara?: (codigo: string) => ResultadoEscaneo;
  /**
   * QR de una tarjeta de lealtad leido con la camara (migracion 115). Solo
   * llega con el programa activo; sin el no se pinta el boton.
   */
  onTarjetaCamara?: (codigo: string) => ResultadoEscaneo;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  favoritosCount?: number;
  viewMode: PosViewMode;
  onViewModeChange: (mode: PosViewMode) => void;
  priceLists: OpcionListaPrecios[];
  /** `SIN_LISTA` o el id de la lista elegida. */
  selectedPriceList: string;
  onPriceListChange: (value: string) => void;
  /** Selector de sucursal del dueño (ver `PosSucursalSelector`). */
  sucursalSlot?: React.ReactNode;
  /** Nombre del local elegido, para la línea de contexto en el celular. */
  sucursalNombre?: string | null;
}

export function PosSearchBar({
  search,
  onSearchChange,
  onKeyDown,
  onCodigoCamara,
  onTarjetaCamara,
  categories,
  selectedCategory,
  onCategoryChange,
  favoritosCount = 0,
  viewMode,
  onViewModeChange,
  priceLists,
  selectedPriceList,
  onPriceListChange,
  sucursalSlot,
  sucursalNombre,
}: PosSearchBarProps) {
  const t = useTranslations();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  const showCategorySelect = categories.length > 0 || favoritosCount > 0;
  const listaActiva =
    selectedPriceList !== SIN_LISTA
      ? priceLists.find((l) => l.id === selectedPriceList)?.nombre ?? null
      : null;

  // Celular (debajo de `sm`): una sola fila (buscar/escanear + Ajustes) y las
  // categorias como chips. Sucursal, lista de precios y vista se cambian poco:
  // viven en la hoja de Ajustes en vez de ocupar tres filas fijas. Desde `sm`
  // todo sigue como antes (`sm:contents` deja a los hijos en la fila de siempre).
  const chip = (activo: boolean) =>
    cn(
      "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors",
      activo
        ? "bg-foreground font-semibold text-background"
        : "border border-border bg-card text-foreground"
    );

  return (
    // `sm:flex-wrap`: la fila se parte cuando no cabe. Con sucursal, categoria,
    // lista de precios, vista y "Agregar articulo" suma ~950 px; en una
    // pantalla de 1280 px la columna de productos tiene ~670 y, sin partirse,
    // el buscador quedaba reducido a la lupa y el carrito salia de la pantalla.
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 animate-fade-in-up stagger-1">
      <div className="flex items-center gap-2 sm:contents">
        <div className="relative flex-1 min-w-0 sm:min-w-[12rem] max-w-md">
          <Search className="absolute left-3.5 sm:left-2.5 top-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("pos.barcodePlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onKeyDown}
            // `text-base` en celular: con menos de 16 px el iPhone hace zoom al
            // enfocar el campo.
            className={cn(
              "h-12 rounded-xl pl-10 text-base sm:h-9 sm:rounded-md sm:pl-8 sm:text-sm",
              onCodigoCamara && "pr-12 sm:pr-9"
            )}
          />
          {onCodigoCamara && (
            <BotonEscanear
              modo="continuo"
              titulo="Escanear productos"
              onCodigo={onCodigoCamara}
              className="max-sm:h-10 max-sm:w-10 max-sm:rounded-lg max-sm:bg-primary max-sm:text-primary-foreground max-sm:hover:bg-primary/90 max-sm:hover:text-primary-foreground"
            />
          )}
        </div>
        {onTarjetaCamara && (
          <BotonEscanear
            modo="continuo"
            variante="suelto"
            titulo="Escanear tarjeta de lealtad"
            descripcion="Apunta la cámara al QR de la tarjeta del cliente."
            icono={<QrCode className="h-5 w-5 sm:h-4 sm:w-4" />}
            onCodigo={onTarjetaCamara}
            className="max-sm:h-12 max-sm:w-12 max-sm:rounded-xl max-sm:border-border max-sm:bg-card max-sm:text-foreground sm:h-9 sm:w-9"
          />
        )}
        <button
          type="button"
          onClick={() => setAjustesAbiertos(true)}
          aria-label="Ajustes del mostrador: sucursal, lista de precios y vista"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground sm:hidden"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {listaActiva && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </button>
      </div>

      {(sucursalNombre || listaActiva) && (
        <p className="text-xs text-muted-foreground sm:hidden">
          {sucursalNombre && (
            <>
              Sucursal <strong className="font-semibold text-foreground">{sucursalNombre}</strong>
            </>
          )}
          {sucursalNombre && listaActiva && " · "}
          {listaActiva && (
            <>
              Lista <strong className="font-semibold text-primary">{listaActiva}</strong>
            </>
          )}
        </p>
      )}

      {showCategorySelect && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
          <button type="button" className={chip(selectedCategory === "all")} onClick={() => onCategoryChange("all")}>
            Todas
          </button>
          {favoritosCount > 0 && (
            <button
              type="button"
              className={chip(selectedCategory === "favorites")}
              onClick={() => onCategoryChange("favorites")}
            >
              <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
              Favoritos
            </button>
          )}
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={chip(selectedCategory === cat)}
              onClick={() => onCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <PosAjustesHoja
        open={ajustesAbiertos}
        onOpenChange={setAjustesAbiertos}
        sucursalSlot={sucursalSlot}
        priceLists={priceLists}
        selectedPriceList={selectedPriceList}
        onPriceListChange={onPriceListChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      <div className="hidden sm:contents">
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
      </div>
    </div>
  );
}