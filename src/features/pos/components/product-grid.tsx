"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Palette, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import type { Producto } from "../types/pos.types";

/**
 * Las columnas se calculan sobre el ancho REAL del contenedor (`@container`),
 * no sobre el del viewport. Es la diferencia que importa aquí: el panel del
 * carrito ocupa un ancho fijo, así que en un portátil de 1280px a esta
 * cuadrícula le quedan ~608px. Con los breakpoints de viewport que había antes
 * (`lg:grid-cols-6`) eso daba tarjetas de 95px, mientras que en una pantalla de
 * 1920px las mismas clases daban 174px — el código se veía bien donde se diseñó
 * y mal donde se usa.
 *
 * `auto-fill` y NO `auto-fit`: con `auto-fit` un catálogo de 5 productos
 * estiraría cada tarjeta hasta llenar la fila entera.
 *
 * Medido en el navegador tras el cambio:
 *
 *   contenedor  400px → 2 col × 176px
 *   contenedor  640px → 3 col × 197px
 *   contenedor  800px → 4 col × 186px   <- valle
 *   contenedor 1000px → 4 col × 236px
 *   contenedor 1300px → 5 col × 247px
 *
 * OJO: la progresión NO es monótona, y no puede serlo. Con `auto-fill`, al
 * ensancharse el contenedor llega un punto en que entra una columna más y la
 * tarjeta encoge de golpe — es un diente de sierra. Lo que importa no es
 * eliminarlo (no se puede sin fijar el número de columnas, que es justo lo que
 * causaba el problema) sino que el VALLE se mantenga alto: el mínimo medido son
 * 186px, contra los 95px que daba el código anterior en un portátil.
 *
 * Si se tocan estos mínimos, volver a medir el valle, no solo el caso ancho.
 */
const GRID_CLASSES = [
  "grid gap-2",
  "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
  "@3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]",
  "@5xl:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
].join(" ");

interface ProductGridProps {
  products: Producto[];
  loading: boolean;
  hasSearch: boolean;
  onAddProduct: (product: Producto) => void;
  /**
   * Cuántas variantes tiene cada producto, por id. Solo el conteo: la
   * cuadrícula no necesita las variantes en sí, y pasarlas enteras acoplaría
   * este componente a un tipo que no usa.
   */
  variantCountByProduct?: Record<string, number>;
  /**
   * Precio a pintar. Por defecto el del catalogo; con una lista de precios
   * elegida, el de la lista. Se inyecta en vez de leer `precio_venta` a
   * secas para que la cuadricula y el carrito no puedan discrepar.
   */
  precioDe?: (product: Producto) => number;
}

export function ProductGrid({
  products,
  loading,
  hasSearch,
  onAddProduct,
  variantCountByProduct,
  precioDe,
}: ProductGridProps) {
  const t = useTranslations();

  return (
    <div className="@container flex-1 rounded-lg border border-border bg-card p-4 overflow-y-auto animate-fade-in-up stagger-2">
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
        <div className={GRID_CLASSES}>
          {products.map((product, index) => {
            // Solo cuenta si tiene variantes REALMENTE creadas. Un producto
            // marcado como `permite_variantes` pero sin ninguna se vende
            // directo y no abre diálogo, así que marcarlo engañaría al cajero.
            const variantCount = variantCountByProduct?.[product.id] ?? 0;
            return (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              className="flex flex-col items-start overflow-hidden rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              <div className="relative w-full aspect-[4/3] shrink-0">
                {product.imagen_url ? (
                  <Image
                    src={product.imagen_url}
                    alt={product.nombre}
                    width={260}
                    height={195}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-base font-semibold text-muted-foreground">
                    {getInitials(product.nombre)}
                  </div>
                )}
                {variantCount > 0 && (
                  // Avisa ANTES de pulsar que este producto va a pedir elegir
                  // variante. El ícono es el mismo `Palette` que muestra cada
                  // opción del diálogo, para que el distintivo anticipe lo que
                  // viene. En azul y no en verde a propósito: el verde ya
                  // significa "hay stock" en esta misma tarjeta.
                  <span
                    className="absolute right-1 top-1 flex items-center gap-1 rounded-full bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm"
                    title={t("pos.variantsAvailable", { count: variantCount })}
                  >
                    <Palette className="h-3 w-3" aria-hidden="true" />
                    {variantCount}
                    <span className="sr-only">
                      {t("pos.variantsAvailable", { count: variantCount })}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-col items-start w-full p-2">
                {product.categoria && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate w-full">
                    {product.categoria}
                  </span>
                )}
                <span className="text-sm font-medium truncate w-full mt-0.5">
                  {product.nombre}
                </span>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-[13px] text-muted-foreground font-mono">
                    ${(precioDe ? precioDe(product) : product.precio_venta).toFixed(2)}
                  </span>
                  {product.es_servicio ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Servicio
                    </Badge>
                  ) : product.stock_actual <= product.stock_minimo ? (
                    <Badge
                      variant="destructive"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {t("products.lowStock")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                    >
                      OK
                    </Badge>
                  )}
                </div>
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}