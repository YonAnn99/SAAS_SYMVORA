"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Heart, Package, Palette, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";
import { stockStatus } from "@/features/inventory/stock-status";
import { precioDeVariante, resumenConVariantes } from "@/features/inventory/resumen-variantes";
import type { Producto, VarianteProducto } from "../types/pos.types";
import { variantLabel, variantPrice } from "./variant-picker-dialog";
import type { PosViewMode } from "./pos-search-bar";
import { variantesVisiblesEnFavoritos } from "../favoritos-pos";
import { seVendeComoGeneral } from "@/features/sucursales/stock";

/**
 * Las columnas se calculan sobre el ancho REAL del contenedor (`@container`),
 * no sobre el del viewport.
 */
// Celular (contenedor de menos de 28rem): 2 columnas fijas. Con
// `minmax(150px,1fr)` en ~330 px no cabian dos y caia a UNA columna con foto
// enorme: un producto por pantalla (rediseño del 2026-10-06).
const GRID_CLASSES = [
  "grid gap-3 grid-cols-2",
  "@md:gap-2 @md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
  "@3xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]",
  "@5xl:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]",
].join(" ");

export function getProductFamilyColor(productId: string) {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash << 5) - hash + productId.charCodeAt(i);
    hash |= 0;
  }
  const colors = [
    { border: "border-l-indigo-500", bg: "bg-indigo-500/10 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", badgeBorder: "border-indigo-500/30" },
    { border: "border-l-rose-500", bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", badgeBorder: "border-rose-500/30" },
    { border: "border-l-emerald-500", bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", badgeBorder: "border-emerald-500/30" },
    { border: "border-l-amber-500", bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", badgeBorder: "border-amber-500/30" },
    { border: "border-l-sky-500", bg: "bg-sky-500/10 dark:bg-sky-500/20", text: "text-sky-600 dark:text-sky-400", badgeBorder: "border-sky-500/30" },
    { border: "border-l-purple-500", bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400", badgeBorder: "border-purple-500/30" },
    { border: "border-l-teal-500", bg: "bg-teal-500/10 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400", badgeBorder: "border-teal-500/30" },
    { border: "border-l-orange-500", bg: "bg-orange-500/10 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400", badgeBorder: "border-orange-500/30" },
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

type PosGridItem =
  | {
      kind: "product";
      key: string;
      product: Producto;
      variantCount: number;
    }
  | {
      kind: "variant";
      key: string;
      product: Producto;
      variant: VarianteProducto;
      familyColor: ReturnType<typeof getProductFamilyColor>;
    }
  | {
      kind: "product-general";
      key: string;
      product: Producto;
      familyColor: ReturnType<typeof getProductFamilyColor>;
    }
  | {
      /** Desglosado: el nombre del producto general sobre sus variantes. No se vende. */
      kind: "family-header";
      key: string;
      product: Producto;
      count: number;
      familyColor: ReturnType<typeof getProductFamilyColor>;
    };

interface ProductGridProps {
  products: Producto[];
  loading: boolean;
  hasSearch: boolean;
  viewMode?: PosViewMode;
  isFavoritesFilter?: boolean;
  onAddProduct: (product: Producto) => void;
  onAddVariant?: (product: Producto, variant: VarianteProducto | null) => void;
  variantsByProduct?: Record<string, VarianteProducto[]>;
  variantCountByProduct?: Record<string, number>;
  precioDe?: (product: Producto, variant?: VarianteProducto | null) => number;
  /** Con el filtro Favoritos en Desglosado: solo las variantes favoritas. */
  favoritos?: ReadonlySet<string>;
  variantesFavoritas?: ReadonlySet<string>;
  /** Cuánto lleva ya el carrito: por producto (todas sus líneas) y por variante. */
  enCarrito?: { porProducto: Record<string, number>; porVariante: Record<string, number> };
}

/** "×2", "×0.75": lo que ya va en el carrito, sobre la foto. */
function MarcaEnCarrito({
  cantidad,
  lado = "izquierda",
}: {
  cantidad: number | undefined;
  lado?: "izquierda" | "derecha";
}) {
  if (!cantidad || cantidad <= 0) return null;
  return (
    <span
      className={cn(
        "absolute top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-sm",
        lado === "izquierda" ? "left-1.5" : "right-1.5"
      )}
    >
      <span className="sr-only">En el carrito: </span>×{Number(cantidad.toFixed(3))}
    </span>
  );
}

/** El "+" de la tarjeta en celular. Decorativo: toda la tarjeta es el botón. */
function MasCelular() {
  return (
    <span
      className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background @md:hidden"
      aria-hidden="true"
    >
      <Plus className="h-5 w-5" strokeWidth={2.4} />
    </span>
  );
}

export function ProductGrid({
  products,
  loading,
  hasSearch,
  viewMode = "grouped",
  isFavoritesFilter = false,
  onAddProduct,
  onAddVariant,
  variantsByProduct,
  variantCountByProduct,
  precioDe,
  favoritos,
  variantesFavoritas,
  enCarrito,
}: ProductGridProps) {
  const t = useTranslations();

  const gridItems = useMemo<PosGridItem[]>(() => {
    if (viewMode === "grouped") {
      return products.map((product) => ({
        kind: "product" as const,
        key: product.id,
        product,
        variantCount:
          variantCountByProduct?.[product.id] ??
          (variantsByProduct?.[product.id] ?? []).length,
      }));
    }

    // Modo desglosado
    const items: PosGridItem[] = [];
    for (const product of products) {
      const todas = variantsByProduct?.[product.id] ?? [];
      // Favoritos: si el producto no es favorito, solo sus variantes favoritas
      // (marcar "Talla M" no debe traer todas las tallas).
      const soloFavoritas =
        isFavoritesFilter && favoritos && variantesFavoritas && !favoritos.has(product.id);
      const variants = soloFavoritas
        ? variantesVisiblesEnFavoritos(product.id, todas, favoritos, variantesFavoritas)
        : todas;
      if (variants.length === 0) {
        // Producto sin variantes creadas
        items.push({
          kind: "product" as const,
          key: product.id,
          product,
          variantCount: 0,
        });
      } else {
        const familyColor = getProductFamilyColor(product.id);
        // Encabezado de la familia ("Coca Cola") y debajo cada variante.
        items.push({
          kind: "family-header" as const,
          key: `fam-${product.id}`,
          product,
          count: variants.length,
          familyColor,
        });
        for (const variant of variants) {
          items.push({
            kind: "variant" as const,
            key: `var-${variant.id}`,
            product,
            variant,
            familyColor,
          });
        }
        // Si el producto base tiene stock sin clasificar disponible (no en
        // Favoritos por variante: ahi solo van las variantes marcadas). El
        // general que solo agrupa variantes no se vende solo.
        if (
          !soloFavoritas &&
          Number(product.stock_actual) > 0 &&
          seVendeComoGeneral(product, todas)
        ) {
          items.push({
            kind: "product-general" as const,
            key: `gen-${product.id}`,
            product,
            familyColor,
          });
        }
      }
    }
    return items;
  }, [products, variantsByProduct, variantCountByProduct, viewMode, isFavoritesFilter, favoritos, variantesFavoritas]);

  return (
    // En celular sin marco: las tarjetas van directo sobre el fondo y ganan el
    // ancho que se comian el borde y el relleno.
    <div className="@container flex-1 overflow-y-auto animate-fade-in-up stagger-2 sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-4">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      ) : gridItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 h-full">
          {isFavoritesFilter ? (
            <>
              <Heart className="h-10 w-10 text-rose-500/50 fill-rose-500/20" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No tienes productos marcados como favoritos
                </p>
                <p className="text-xs text-muted-foreground">
                  Márcalos con el corazón en el módulo de Productos para verlos aquí.
                </p>
              </div>
            </>
          ) : (
            <>
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {hasSearch
                  ? "No se encontraron productos"
                  : "No hay productos disponibles"}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={GRID_CLASSES}>
          {gridItems.map((item, index) => {
            if (item.kind === "family-header") {
              return (
                <div
                  key={item.key}
                  className={cn(
                    "col-span-full flex items-center gap-2 pt-2 first:pt-0",
                    item.familyColor.text
                  )}
                >
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full border-2", item.familyColor.badgeBorder, item.familyColor.bg)}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {item.product.nombre}
                  </span>
                  {item.product.categoria && (
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
                      {item.product.categoria}
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      item.familyColor.bg,
                      item.familyColor.badgeBorder
                    )}
                  >
                    {item.count === 1 ? "1 variante" : `${item.count} variantes`}
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
              );
            }

            if (item.kind === "variant") {
              const stock = Number(item.variant.stock_actual);
              // Variante de un servicio (Corte chico / grande): no lleva stock.
              const servicio = Boolean(item.product.es_servicio);
              const agotado = !servicio && stock <= 0;
              const precioEfectivo = precioDe
                ? precioDe(item.product, item.variant)
                : variantPrice(item.variant, item.product);

              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (agotado) {
                      toast.error(
                        `La variante "${variantLabel(item.variant)}" está agotada`
                      );
                      return;
                    }
                    if (onAddVariant) {
                      onAddVariant(item.product, item.variant);
                    } else {
                      onAddProduct(item.product);
                    }
                  }}
                  className={cn(
                    "relative flex flex-col items-start overflow-hidden rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up border-l-4 @max-md:rounded-2xl",
                    item.familyColor.border
                  )}
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <div className="relative w-full aspect-[4/3] shrink-0">
                    {/* La foto de la variante si tiene; si no, la del producto. */}
                    {item.variant.imagen_url || item.product.imagen_url ? (
                      <Image
                        src={(item.variant.imagen_url || item.product.imagen_url) as string}
                        alt={`${item.product.nombre} - ${variantLabel(item.variant)}`}
                        width={260}
                        height={195}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-base font-semibold text-muted-foreground">
                        {getInitials(item.product.nombre)}
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm",
                        item.familyColor.bg,
                        item.familyColor.text,
                        "border",
                        item.familyColor.badgeBorder
                      )}
                      title={`Variante de: ${item.product.nombre}`}
                    >
                      <Palette className="h-3 w-3" aria-hidden="true" />
                      {variantLabel(item.variant)}
                    </span>
                    <MarcaEnCarrito cantidad={enCarrito?.porVariante[item.variant.id]} lado="derecha" />
                  </div>
                  <div className="flex flex-col items-start w-full p-2">
                    {item.product.categoria && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate w-full">
                        {item.product.categoria}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate w-full mt-0.5">
                      {item.product.nombre}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold truncate w-full mt-0.5",
                        item.familyColor.text
                      )}
                    >
                      {variantLabel(item.variant)}
                    </span>
                    <div className="flex items-center justify-between w-full mt-1">
                      <span className="text-[13px] text-muted-foreground font-mono">
                        ${precioEfectivo.toFixed(2)}
                      </span>
                      {servicio ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Servicio
                        </Badge>
                      ) : agotado ? (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Agotado
                        </Badge>
                      ) : stock <= item.product.stock_minimo ? (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {stock} disp.
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                        >
                          {stock} disp.
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            if (item.kind === "product-general") {
              const stock = Number(item.product.stock_actual);
              const precioEfectivo = precioDe
                ? precioDe(item.product, null)
                : Number(item.product.precio_venta);

              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (onAddVariant) {
                      onAddVariant(item.product, null);
                    } else {
                      onAddProduct(item.product);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-start overflow-hidden rounded-lg border border-dashed border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up border-l-4",
                    item.familyColor.border
                  )}
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <div className="relative w-full aspect-[4/3] shrink-0">
                    {item.product.imagen_url ? (
                      <Image
                        src={item.product.imagen_url}
                        alt={item.product.nombre}
                        width={260}
                        height={195}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-base font-semibold text-muted-foreground">
                        {getInitials(item.product.nombre)}
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-muted/90 text-muted-foreground border border-border shadow-sm backdrop-blur-sm">
                      <Package className="h-3 w-3" aria-hidden="true" />
                      General
                    </span>
                  </div>
                  <div className="flex flex-col items-start w-full p-2">
                    {item.product.categoria && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate w-full">
                        {item.product.categoria}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate w-full mt-0.5">
                      {item.product.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full mt-0.5">
                      Stock general sin clasificar
                    </span>
                    <div className="flex items-center justify-between w-full mt-1">
                      <span className="text-[13px] text-muted-foreground font-mono">
                        ${precioEfectivo.toFixed(2)}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
                      >
                        {stock} disp.
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            }

            // item.kind === "product"
            const { product, variantCount } = item;
            const precioEfectivo = precioDe
              ? precioDe(product, null)
              : product.precio_venta;
            // Con variantes, la tarjeta es el producto general: "Desde" el
            // precio mas bajo de sus variantes (con la lista aplicada) y el
            // estado segun ellas, no segun el stock propio (puede ser 0).
            const variantesDe = variantsByProduct?.[product.id] ?? [];
            const precioDesde =
              variantesDe.length > 0
                ? Math.min(
                    ...variantesDe.map((v) =>
                      precioDe ? precioDe(product, v) : precioDeVariante(v, product)
                    )
                  )
                : null;
            const estadoTarjeta =
              variantesDe.length > 0
                ? resumenConVariantes(product, variantesDe).estado
                : stockStatus(product);

            return (
              <button
                key={product.id}
                onClick={() => onAddProduct(product)}
                className="relative flex flex-col items-start overflow-hidden rounded-lg border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-left animate-fade-in-up @max-md:rounded-2xl"
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
                  <MarcaEnCarrito cantidad={enCarrito?.porProducto[product.id]} />
                </div>
                <div className="flex flex-col items-start w-full p-2 @max-md:p-3 @max-md:pr-12">
                  {product.categoria && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate w-full @max-md:hidden">
                      {product.categoria}
                    </span>
                  )}
                  <span className="text-sm font-medium truncate w-full mt-0.5 @max-md:mt-0 @max-md:whitespace-normal @max-md:line-clamp-2 @max-md:min-h-10 @max-md:leading-5">
                    {product.nombre}
                  </span>
                  <div className="flex items-center justify-between w-full mt-1 @max-md:flex-col @max-md:items-start @max-md:gap-1">
                    <span className="text-[13px] text-muted-foreground font-mono @max-md:text-[15px] @max-md:font-bold @max-md:text-foreground">
                      {precioDesde !== null
                        ? `Desde $${precioDesde.toFixed(2)}`
                        : `$${precioEfectivo.toFixed(2)}`}
                    </span>
                    {/* `stockStatus()` en vez de la regla a mano que habia
                        aqui (`stock_actual <= stock_minimo`): es la misma
                        divergencia que el modulo de stock dice haber eliminado
                        ya una vez, y la que hacia que un agotado se anunciara
                        como "stock bajo". Con variantes, el de su resumen. */}
                    {estadoTarjeta === "servicio" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Servicio
                      </Badge>
                    ) : estadoTarjeta === "bajo" || estadoTarjeta === "agotado" ? (
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
                <MasCelular />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}