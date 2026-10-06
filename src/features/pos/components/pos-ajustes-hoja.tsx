"use client";

import { Check, Layers, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SIN_LISTA, type OpcionListaPrecios, type PosViewMode } from "./pos-search-bar";

/**
 * Ajustes del mostrador en el celular: sucursal, lista de precios y vista de
 * los productos con variantes. En escritorio esos controles siguen en la barra
 * del POS; en el celular ocupaban tres filas fijas antes del primer producto y
 * se cambian poco, asi que viven aqui (rediseño del 2026-10-06).
 */
export function PosAjustesHoja({
  open,
  onOpenChange,
  sucursalSlot,
  priceLists,
  selectedPriceList,
  onPriceListChange,
  viewMode,
  onViewModeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursalSlot?: React.ReactNode;
  priceLists: OpcionListaPrecios[];
  selectedPriceList: string;
  onPriceListChange: (value: string) => void;
  viewMode: PosViewMode;
  onViewModeChange: (mode: PosViewMode) => void;
}) {
  const opcionesLista = [{ id: SIN_LISTA, nombre: "Precios normales" }, ...priceLists];

  const vista = (modo: PosViewMode, etiqueta: string, Icono: typeof Layers) => (
    <button
      type="button"
      onClick={() => onViewModeChange(modo)}
      aria-pressed={viewMode === modo}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-lg text-sm transition-colors",
        viewMode === modo
          ? "bg-muted font-semibold text-foreground shadow-sm"
          : "text-muted-foreground"
      )}
    >
      <Icono className="h-4 w-4" aria-hidden="true" />
      {etiqueta}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-3xl p-0 sm:hidden">
        <SheetHeader className="px-5 pb-2 pt-5">
          <SheetTitle className="text-lg">Ajustes del mostrador</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-5 pb-6 pt-2">
          {sucursalSlot && (
            <section className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-muted-foreground">Sucursal</p>
              {/* El mismo selector de la barra de escritorio. */}
              <div className="[&_button]:h-12 [&_button]:rounded-xl [&_button]:text-base">{sucursalSlot}</div>
            </section>
          )}

          {priceLists.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-muted-foreground">Lista de precios</p>
              <div className="overflow-hidden rounded-xl border border-border">
                {opcionesLista.map((lista, i) => {
                  const elegida = selectedPriceList === lista.id;
                  return (
                    <button
                      key={lista.id}
                      type="button"
                      onClick={() => onPriceListChange(lista.id)}
                      aria-pressed={elegida}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px]",
                        i > 0 && "border-t border-border",
                        elegida ? "bg-primary/10 font-semibold" : "bg-card"
                      )}
                    >
                      <span className="flex-1">{lista.nombre}</span>
                      {elegida && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Al cobrar, la lista regresa a Precios normales.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-muted-foreground">
              Vista de productos con variantes
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
              {vista("grouped", "Agrupado", Layers)}
              {vista("unbundled", "Desglosado", LayoutGrid)}
            </div>
          </section>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-12 rounded-xl bg-foreground text-base font-semibold text-background"
          >
            Listo
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
