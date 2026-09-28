"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TODAS_CATEGORIAS } from "../purchase-order-items";

/**
 * Filtro de categoria del selector de productos de compras y ordenes. Es el
 * mismo desplegable que el del punto de venta: con cientos de productos el
 * buscador solo no basta, y acotar por categoria es lo que el usuario ya
 * conoce del POS.
 *
 * Si el catalogo no tiene categorias no se muestra: seria un control muerto.
 */
export function FiltroCategoriaCompra({
  categorias,
  value,
  onChange,
}: {
  categorias: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (categorias.length === 0) return null;

  return (
    <Select value={value} onValueChange={(v) => onChange((v as string | null) ?? TODAS_CATEGORIAS)}>
      <SelectTrigger aria-label="Filtrar productos por categoría" className="h-7 w-40 text-xs">
        <SelectValue placeholder="Categoría">
          {/* Con render function: evita que Base UI muestre 'all' crudo. */}
          {(v: unknown) =>
            v === TODAS_CATEGORIAS ? "Todas las categorías" : (v as string) || "Categoría"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODAS_CATEGORIAS}>Todas las categorías</SelectItem>
        {categorias.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
