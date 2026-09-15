"use client";

import { Heart, PackageX, TriangleAlert } from "lucide-react";
import type { ProductFilters } from "@/features/inventory/stock-status";

/**
 * Filtros de un clic, al lado de Filtros/CSV/PDF.
 *
 * ESCRIBEN EN EL MISMO ESTADO QUE EL DIALOGO, no en uno paralelo. Es la
 * decision importante del componente: "Stock bajo" aqui y "Stock bajo" dentro
 * del dialogo son el mismo `filters.stock`, asi que activar el chip deja la
 * casilla del dialogo marcada y el contador del boton Filtros cuadra solo. Con
 * dos estados podrian contradecirse y no habria forma de saber cual manda.
 *
 * A diferencia del dialogo, aqui NO hay borrador: un chip se aplica al
 * pulsarlo. El borrador existe alli solo porque hay Cancelar y Limpiar.
 */

interface QuickFiltersProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  /** Conteos sobre el catálogo COMPLETO, no sobre lo ya filtrado. */
  stockBajoCount: number;
  sinMinimoCount: number;
  favoritosCount: number;
}

export function QuickFilters({
  filters,
  onChange,
  stockBajoCount,
  sinMinimoCount,
  favoritosCount,
}: QuickFiltersProps) {
  const stockBajoActivo = filters.stock.includes("bajo");

  return (
    <>
      <Chip
        activo={stockBajoActivo}
        onClick={() =>
          onChange({
            ...filters,
            // Se añade o se quita de la lista en vez de sustituirla: si el
            // usuario ya tenía "Agotado" marcado desde el diálogo, el chip no
            // debe borrárselo.
            stock: stockBajoActivo
              ? filters.stock.filter((s) => s !== "bajo")
              : [...filters.stock, "bajo"],
          })
        }
        count={stockBajoCount}
        icon={<TriangleAlert className="h-3.5 w-3.5" />}
        title="Productos por acabarse: existencias iguales o por debajo del mínimo"
      >
        Stock bajo
      </Chip>

      <Chip
        activo={Boolean(filters.sinMinimo)}
        onClick={() => onChange({ ...filters, sinMinimo: !filters.sinMinimo })}
        count={sinMinimoCount}
        icon={<PackageX className="h-3.5 w-3.5" />}
        // El término no se explica solo, y sin esto nadie adivina que "sin
        // mínimo" es la razón por la que esos productos nunca avisan.
        title="Productos sin stock mínimo configurado: el sistema no puede avisarte de que se acaban"
      >
        Stock indefinido
      </Chip>

      <Chip
        activo={Boolean(filters.soloFavoritos)}
        onClick={() =>
          onChange({ ...filters, soloFavoritos: !filters.soloFavoritos })
        }
        count={favoritosCount}
        icon={
          <Heart
            className={`h-3.5 w-3.5 ${filters.soloFavoritos ? "fill-current" : ""}`}
          />
        }
        title="Los productos que marcaste con el corazón"
      >
        Favoritos
      </Chip>
    </>
  );
}

function Chip({
  activo,
  onClick,
  count,
  icon,
  title,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  count: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={activo}
      // Mismas clases que los chips de stock del diálogo
      // (products-filter-dialog.tsx), para que se lean como lo mismo. El `h-8`
      // es lo único que se añade: alinea con la búsqueda y con Filtros/CSV/PDF.
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${
        activo
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:bg-muted"
      }`}
    >
      {icon}
      {children}
      {/* El conteo es lo que convierte esto en un diagnóstico ("tienes 3 por
          acabarse") y no solo en un filtro. */}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
