"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { formatMXN } from "@/lib/money";
import type { FilaSeleccionable } from "../../price-list";

/**
 * Lista de productos y variantes con casilla, para armar o ampliar una lista de
 * precios.
 *
 * Es el PRIMER patrón de selección múltiple del proyecto: no había ninguna
 * tabla con casillas en todo el repo, así que aquí se fija.
 */

interface ProductPickerProps {
  filas: FilaSeleccionable[];
  seleccion: ReadonlySet<string>;
  onToggle: (clave: string) => void;
  onToggleTodos: (claves: string[], marcar: boolean) => void;
  /** Filas que ya están en la lista: se muestran deshabilitadas. */
  yaEnLista?: ReadonlySet<string>;
}

export function ProductPicker({
  filas,
  seleccion,
  onToggle,
  onToggleTodos,
  yaEnLista,
}: ProductPickerProps) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => f.busqueda.toLowerCase().includes(q));
  }, [filas, busqueda]);

  // "Seleccionar todo" actúa SOLO sobre lo visible. Con el buscador puesto,
  // marcar todo el catálogo entero sería una sorpresa desagradable.
  const seleccionables = visibles.filter((f) => !yaEnLista?.has(f.clave));
  const marcadas = seleccionables.filter((f) => seleccion.has(f.clave)).length;
  const todas = seleccionables.length > 0 && marcadas === seleccionables.length;
  const algunas = marcadas > 0 && !todas;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto, talla o color..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      <label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer select-none">
        <Checkbox
          checked={todas}
          indeterminate={algunas}
          onCheckedChange={() =>
            onToggleTodos(
              seleccionables.map((f) => f.clave),
              !todas
            )
          }
          disabled={seleccionables.length === 0}
        />
        <span className="font-medium">Seleccionar todo</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {marcadas} de {seleccionables.length}
        </span>
      </label>

      <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
        {visibles.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin resultados
          </p>
        ) : (
          visibles.map((f) => {
            const yaEsta = yaEnLista?.has(f.clave) ?? false;
            const marcada = seleccion.has(f.clave);
            return (
              <label
                key={f.clave}
                className={`flex items-center gap-2.5 border-b border-border px-3 py-2 text-sm last:border-b-0 ${
                  yaEsta
                    ? "opacity-50"
                    : "cursor-pointer hover:bg-muted/50"
                } ${marcada ? "bg-primary/5" : ""}`}
              >
                <Checkbox
                  checked={yaEsta || marcada}
                  disabled={yaEsta}
                  onCheckedChange={() => onToggle(f.clave)}
                />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                  {getInitials(f.nombre)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.nombre}</span>
                  {/* La variante se distingue del padre por este subtítulo; sin
                      él, tres tallas del mismo suéter se verían idénticas. */}
                  {f.sufijo && (
                    <span className="block text-xs text-muted-foreground">
                      {f.sufijo}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {formatMXN(f.precio_base)}
                </span>
                {yaEsta && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    ya está
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
