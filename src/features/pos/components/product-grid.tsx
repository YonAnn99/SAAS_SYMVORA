"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {products.map((product, index) => (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              className="flex flex-col items-start p-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              <span className="text-sm font-medium truncate w-full">
                {product.nombre}
              </span>
              <span className="text-xs text-muted-foreground font-mono mt-1">
                ${product.precio_venta.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                Stock: {product.stock_actual}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}