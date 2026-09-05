"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import type { Producto } from "../types/pos.types";

interface ProductGridProps {
  products: Producto[];
  loading: boolean;
  hasSearch: boolean;
  onAddProduct: (product: Producto) => void;
}

export function ProductGrid({
  products,
  loading,
  hasSearch,
  onAddProduct,
}: ProductGridProps) {
  const t = useTranslations();

  return (
    <div className="flex-1 rounded-lg border border-border bg-card p-4 overflow-y-auto animate-fade-in-up stagger-2">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 h-full">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {hasSearch
              ? "No se encontraron productos"
              : "No hay productos disponibles"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {products.map((product, index) => (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              className="flex flex-col items-start overflow-hidden rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              <div className="w-full aspect-[4/3] shrink-0">
                {product.imagen_url ? (
                  <Image
                    src={product.imagen_url}
                    alt={product.nombre}
                    width={120}
                    height={90}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
                    {getInitials(product.nombre)}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start w-full p-2">
                {product.categoria && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground truncate w-full">
                    {product.categoria}
                  </span>
                )}
                <span className="text-xs font-medium truncate w-full mt-0.5">
                  {product.nombre}
                </span>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ${product.precio_venta.toFixed(2)}
                  </span>
                  {product.es_servicio ? (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      Servicio
                    </Badge>
                  ) : product.stock_actual <= product.stock_minimo ? (
                    <Badge
                      variant="destructive"
                      className="text-[9px] px-1 py-0"
                    >
                      {t("products.lowStock")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                    >
                      OK
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}