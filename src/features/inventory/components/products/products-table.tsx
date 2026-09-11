"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Package, Pencil, Trash2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Producto } from "../../types/inventory.types";
import { calcularMargenProducto } from "@/lib/profit";
import { stockStatus } from "@/features/inventory/stock-status";

interface ProductsTableProps {
  products: Producto[];
  filteredProducts: Producto[];
  loading: boolean;
  onEdit: (product: Producto) => void;
  onDelete: (product: Producto) => void;
  onAdd: () => void;
}

export function ProductsTable({
  products,
  filteredProducts,
  loading,
  onEdit,
  onDelete,
  onAdd,
}: ProductsTableProps) {
  const t = useTranslations();

  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {t("products.title")}
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {products.length} productos
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Package className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t("products.noProducts")}
            </p>
            <SpecularActionButton
              tone="add"
              className="h-8 mt-1"
              onClick={onAdd}
            >

              {t("products.addProduct")}
            </SpecularActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("products.name")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("products.barcode")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("products.unit")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.salePrice")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.margin")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("products.currentStock")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">
                    {t("common.status")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2.5">
                        {product.imagen_url ? (
                          <Image
                            src={product.imagen_url}
                            alt={product.nombre}
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-md object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                            {getInitials(product.nombre)}
                          </div>
                        )}
                        <span className="truncate">{product.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {product.codigo_barras || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t(`products.units.${product.unidad_medida}`)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${product.precio_venta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <ProductMarginCell product={product} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {product.stock_actual}
                    </TableCell>
                    <TableCell>
                      <StockBadge product={product} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onEdit(product)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => onDelete(product)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Margen de un producto en la tabla.
 *
 * Sin costo capturado muestra un guion, NUNCA 100%: un producto al que no se
 * le puso costo no es un producto que deje toda la venta como ganancia, y
 * mostrarlo así invitaría a decisiones sobre un número falso.
 */
function ProductMarginCell({
  product,
}: {
  product: { precio_venta: number; costo_compra: number | null };
}) {
  const margen = calcularMargenProducto(product.precio_venta, product.costo_compra);

  if (!margen) {
    return (
      <span className="text-muted-foreground" title="Sin costo capturado">
        —
      </span>
    );
  }

  // Se resalta lo que hay que mirar: pérdida en rojo, margen flaco en ámbar.
  const tone = margen.esPerdida
    ? "text-red-600 dark:text-red-400 font-semibold"
    : margen.margenPct < 10
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";

  return (
    <span className={tone} title={`Ganas $${margen.gananciaUnitaria.toFixed(2)} por unidad`}>
      {margen.margenPct.toFixed(1)}%
    </span>
  );
}

/**
 * Etiqueta de stock, en TRES estados.
 *
 * Antes eran dos (`stock <= minimo ? "Stock bajo" : "OK"`), lo que mostraba un
 * producto agotado como "Stock bajo" — y el filtro del diálogo lo clasificaba
 * como "Agotado". Ahora ambos leen de `stockStatus()`, así que no pueden
 * contradecirse.
 */
function StockBadge({
  product,
}: {
  product: { stock_actual: number; stock_minimo: number };
}) {
  const status = stockStatus(product);

  if (status === "agotado") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        Agotado
      </Badge>
    );
  }

  if (status === "bajo") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
      >
        Stock bajo
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
    >
      OK
    </Badge>
  );
}
