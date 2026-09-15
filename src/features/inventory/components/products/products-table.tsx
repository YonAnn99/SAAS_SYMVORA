"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Heart, Package, Pencil, Trash2 } from "lucide-react";
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
import {
  unidadesPermitidas,
  valorParaEditar,
  type CampoInline,
} from "@/features/inventory/inline-edit";
import { EditableSelectCell, EditableTextCell } from "./editable-cell";

interface ProductsTableProps {
  products: Producto[];
  filteredProducts: Producto[];
  loading: boolean;
  onEdit: (product: Producto) => void;
  onDelete: (product: Producto) => void;
  onAdd: () => void;
  /** Guardado de una sola celda. */
  onInlineSave: (
    product: Producto,
    campo: CampoInline,
    texto: string
  ) => void | Promise<void>;
  /**
   * `inventory.manage`. Sin el, las celdas son texto plano: es el mismo
   * permiso que exige la politica RLS `productos_update`.
   */
  canEdit: boolean;
  /** Ids con un guardado en vuelo. */
  guardando: Set<string>;
  /** Ids marcados con el corazón por el usuario actual. */
  favoritos: ReadonlySet<string>;
  onToggleFavorito: (product: Producto) => void;
}

export function ProductsTable({
  products,
  filteredProducts,
  loading,
  onEdit,
  onDelete,
  onAdd,
  onInlineSave,
  canEdit,
  guardando,
  favoritos,
  onToggleFavorito,
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
                {filteredProducts.map((product) => {
                  const savingRow = guardando.has(product.id);
                  const celda = (campo: CampoInline) => ({
                    canEdit,
                    saving: savingRow,
                    hint: t("products.inlineEditHint"),
                    value: valorParaEditar(product, campo),
                    onCommit: (texto: string) =>
                      void onInlineSave(product, campo, texto),
                  });

                  return (
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
                        {/* La miniatura queda FUERA del area editable: solo el
                            texto entra en edicion. */}
                        <EditableTextCell {...celda("nombre")} className="min-w-0 flex-1">
                          <span className="block truncate">{product.nombre}</span>
                        </EditableTextCell>
                      </div>
                    </TableCell>
                    {/* Codigo de barras NO es editable desde aqui: identifica
                        al producto y un clic accidental lo dejaria sin
                        escanear. Se cambia desde el boton Editar. */}
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {product.codigo_barras || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <EditableSelectCell
                        canEdit={canEdit}
                        saving={savingRow}
                        hint={t("products.inlineUnitHint")}
                        value={product.unidad_medida}
                        options={unidadesPermitidas(product).map((u) => ({
                          value: u,
                          label: t(`products.units.${u}`),
                        }))}
                        onCommit={(valor) =>
                          void onInlineSave(product, "unidad_medida", valor)
                        }
                      >
                        {t(`products.units.${product.unidad_medida}`)}
                      </EditableSelectCell>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <EditableTextCell
                        {...celda("precio_venta")}
                        numerico
                        className="text-right font-mono tabular-nums"
                      >
                        ${product.precio_venta.toFixed(2)}
                      </EditableTextCell>
                    </TableCell>
                    {/* Margen y Estado no se editan porque NO SON COLUMNAS: se
                        calculan a partir del precio, el costo y el stock
                        minimo, y se recalculan solos al editar los de al lado. */}
                    <TableCell className="text-right text-sm font-mono">
                      <ProductMarginCell product={product} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      <EditableTextCell
                        {...celda("stock_actual")}
                        numerico
                        className="text-right font-mono tabular-nums"
                      >
                        {product.stock_actual}
                      </EditableTextCell>
                    </TableCell>
                    <TableCell>
                      <StockBadge product={product} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <FavoriteButton
                          esFavorito={favoritos.has(product.id)}
                          onToggle={() => onToggleFavorito(product)}
                          nombre={product.nombre}
                        />
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
                  );
                })}
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

/**
 * El corazón de favoritos.
 *
 * SOBRE EL RELLENO: cuando está marcado se pinta con `fill-current` sobre
 * `text-foreground`, que en el tema oscuro ES BLANCO y en el claro casi negro.
 * Un blanco fijo (`fill-white`) cumpliría lo pedido a la vista en oscuro pero
 * desaparecería por completo sobre el fondo claro.
 *
 * Va a `h-7`, la misma altura que Editar y la papelera, para que la fila no
 * cambie de alto.
 */
function FavoriteButton({
  esFavorito,
  onToggle,
  nombre,
}: {
  esFavorito: boolean;
  onToggle: () => void;
  nombre: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-1.5 text-xs"
      onClick={onToggle}
      aria-pressed={esFavorito}
      aria-label={
        esFavorito
          ? `Quitar ${nombre} de favoritos`
          : `Marcar ${nombre} como favorito`
      }
      title={esFavorito ? "Quitar de favoritos" : "Marcar como favorito"}
    >
      <Heart
        className={`h-3.5 w-3.5 ${
          esFavorito
            ? "fill-current text-foreground"
            : "text-muted-foreground"
        }`}
      />
    </Button>
  );
}
