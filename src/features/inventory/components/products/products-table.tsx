"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { useModulos } from "@/hooks/use-modulos";
import Image from "next/image";
import { ChevronRight, Package, Pencil } from "lucide-react";
import { BotonEliminar } from "@/components/ui/boton-eliminar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Producto, VarianteProducto } from "../../types/inventory.types";
import { AtributosVariante } from "../variants/atributos-variante-etiqueta";
import { etiquetaAtributos } from "../../atributos-variante";
import { VariantesProductoHoja } from "./variantes-producto-hoja";
import { calcularMargenProducto } from "@/lib/profit";
import {
  unidadesPermitidas,
  valorParaEditar,
  type CampoInline,
} from "@/features/inventory/inline-edit";
import { EditableSelectCell, EditableTextCell } from "./editable-cell";
import { FavoriteButton, StockBadge } from "./product-badges";
import { ProductSwipeList } from "./product-swipe-list";

interface ProductsTableProps {
  products: Producto[];
  filteredProducts: Producto[];
  loading: boolean;
  onEdit: (product: Producto) => void;
  /** `false` si no se pudo borrar (la fila deslizable del celular reaparece). */
  onDelete: (product: Producto) => void | Promise<boolean | void>;
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
  /** Ids marcados para exportar (CSV/PDF "Solo seleccionados"). */
  seleccionados: ReadonlySet<string>;
  onToggleSeleccion: (id: string) => void;
  /** Marca o desmarca todos los productos VISIBLES (con los filtros actuales). */
  onSeleccionarVisibles: (marcar: boolean) => void;
  onLimpiarSeleccion: () => void;
  /** Variantes agrupadas por producto: se despliegan bajo su fila. */
  variantesPorProducto?: Record<string, VarianteProducto[]>;
  onEditVariante?: (variante: VarianteProducto) => void;
  /** `true` si se borro. */
  onDeleteVariante?: (variante: VarianteProducto) => Promise<boolean>;
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
  seleccionados,
  onToggleSeleccion,
  onSeleccionarVisibles,
  onLimpiarSeleccion,
  variantesPorProducto = {},
  onEditVariante,
  onDeleteVariante,
}: ProductsTableProps) {
  const t = useTranslations();
  const { modulos } = useModulos();
  // Escritorio: productos con sus variantes desplegadas (varios a la vez).
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const sig = new Set(prev);
      if (sig.has(id)) sig.delete(id);
      else sig.add(id);
      return sig;
    });
  // Celular: el producto cuya hoja de variantes esta abierta.
  const [hojaDe, setHojaDe] = useState<string | null>(null);
  const productoHoja = hojaDe ? products.find((p) => p.id === hojaDe) ?? null : null;
  const conteoVariantes = Object.fromEntries(
    Object.entries(variantesPorProducto).map(([id, vs]) => [id, vs.length])
  );

  // La casilla de la cabecera mira solo lo VISIBLE: marcada si estan todos,
  // mixta si hay algunos, vacia si ninguno.
  const visiblesMarcados = filteredProducts.filter((p) =>
    seleccionados.has(p.id)
  ).length;
  const todosVisibles =
    filteredProducts.length > 0 && visiblesMarcados === filteredProducts.length;
  const algunosVisibles = visiblesMarcados > 0 && !todosVisibles;

  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium">
            {t("products.title")}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {seleccionados.size > 0 && (
              <>
                <span className="font-medium text-foreground">
                  {seleccionados.size}{" "}
                  {seleccionados.size === 1 ? "seleccionado" : "seleccionados"}
                </span>
                <button
                  type="button"
                  onClick={onLimpiarSeleccion}
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Quitar selección
                </button>
                <span className="text-muted-foreground">·</span>
              </>
            )}
            <span className="text-muted-foreground font-mono">
              {products.length} productos
            </span>
          </div>
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
          <>
          {/* Celular: una pastilla deslizable por producto (editar/eliminar al
              deslizar). La tabla de 9 columnas obligaba a desplazarse de lado. */}
          <div className="md:hidden">
            <ProductSwipeList
              productos={filteredProducts}
              seleccionados={seleccionados}
              onToggleSeleccion={onToggleSeleccion}
              onSeleccionarVisibles={onSeleccionarVisibles}
              todosVisibles={todosVisibles}
              algunosVisibles={algunosVisibles}
              favoritos={favoritos}
              onToggleFavorito={onToggleFavorito}
              onEdit={onEdit}
              onDelete={onDelete}
              conteoVariantes={conteoVariantes}
              onVerVariantes={(p) => setHojaDe(p.id)}
            />
            <VariantesProductoHoja
              producto={productoHoja}
              variantes={hojaDe ? variantesPorProducto[hojaDe] ?? [] : []}
              onOpenChange={(abierta) => !abierta && setHojaDe(null)}
              onEdit={(v) => onEditVariante?.(v)}
              onDelete={async (v) => (onDeleteVariante ? onDeleteVariante(v) : false)}
            />
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pr-0">
                    <Checkbox
                      checked={todosVisibles}
                      indeterminate={algunosVisibles}
                      onCheckedChange={() => onSeleccionarVisibles(!todosVisibles)}
                      aria-label="Seleccionar todos los productos visibles"
                    />
                  </TableHead>
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

                  const variantes = variantesPorProducto[product.id] ?? [];
                  const abierto = abiertos.has(product.id);
                  const idPanel = `variantes-${product.id}`;

                  return (
                  <Fragment key={product.id}>
                  <TableRow
                    data-state={seleccionados.has(product.id) ? "selected" : undefined}
                  >
                    <TableCell className="w-8 pr-0">
                      <Checkbox
                        checked={seleccionados.has(product.id)}
                        onCheckedChange={() => onToggleSeleccion(product.id)}
                        aria-label={`Seleccionar ${product.nombre}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2.5">
                        {/* Con variantes: la flechita las despliega debajo. */}
                        {variantes.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => alternar(product.id)}
                            aria-expanded={abierto}
                            aria-controls={idPanel}
                            aria-label={`${abierto ? "Ocultar" : "Ver"} variantes de ${product.nombre}`}
                            className="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 ${abierto ? "rotate-90" : ""}`}
                            />
                          </button>
                        ) : (
                          <span className="-ml-1 w-6 shrink-0" aria-hidden="true" />
                        )}
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
                        {variantes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => alternar(product.id)}
                            className="shrink-0 rounded-full bg-[#1e3a8a]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1e3a8a] transition-colors hover:bg-[#1e3a8a]/15 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
                            tabIndex={-1}
                          >
                            {variantes.length === 1 ? "1 variante" : `${variantes.length} variantes`}
                          </button>
                        )}
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
                        options={unidadesPermitidas(product, modulos).map((u) => ({
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
                      {/* Un servicio no tiene existencias, así que no se muestra
                          un número ni se deja editar: teclear ahí no cambiaría
                          nada, porque la venta ya no le descuenta stock. */}
                      {product.es_servicio ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <EditableTextCell
                          {...celda("stock_actual")}
                          numerico
                          className="text-right font-mono tabular-nums"
                        >
                          {product.stock_actual}
                        </EditableTextCell>
                      )}
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
                        {/* Mantener presionado = confirmar: ya no abre el
                            dialogo "¿Seguro?" (ver `BotonEliminar`). */}
                        <BotonEliminar
                          nombre={product.nombre}
                          detalle="No se puede deshacer"
                          onEliminar={async () => {
                            await onDelete(product);
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {variantes.length > 0 && (
                    <TableRow className="border-0 hover:bg-transparent">
                      <TableCell colSpan={9} className="p-0">
                        {/* Mismo despliegue que las secciones de "Crear producto"
                            (`accordion.tsx`): 0fr -> 1fr de alto, sin tope. */}
                        <div
                          id={idPanel}
                          style={{
                            display: "grid",
                            gridTemplateRows: abierto ? "1fr" : "0fr",
                            opacity: abierto ? 1 : 0,
                            transition: "grid-template-rows 0.3s ease, opacity 0.2s ease",
                          }}
                          inert={!abierto || undefined}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="mx-3 mb-3 ml-14 rounded-xl border border-border bg-muted/30">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-8 text-[11px] uppercase tracking-wider">Atributos</TableHead>
                                    <TableHead className="h-8 text-[11px] uppercase tracking-wider">SKU</TableHead>
                                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">Precio</TableHead>
                                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">Stock</TableHead>
                                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">{t("common.actions")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {variantes.map((v) => (
                                    <TableRow key={v.id}>
                                      <TableCell className="py-1.5 text-sm">
                                        <AtributosVariante variant={v} vacio="Sin atributos" />
                                      </TableCell>
                                      <TableCell className="py-1.5 text-sm font-mono text-muted-foreground">
                                        {v.sku || "-"}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-right text-sm font-mono">
                                        ${v.precio_venta.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-right text-sm font-mono">
                                        {v.stock_actual}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => onEditVariante?.(v)}
                                          >
                                            <Pencil className="h-3 w-3 mr-1" />
                                            {t("common.edit")}
                                          </Button>
                                          <BotonEliminar
                                            nombre={`la variante ${etiquetaAtributos(v) || product.nombre}`}
                                            detalle="No se puede deshacer"
                                            onEliminar={async () => {
                                              await onDeleteVariante?.(v);
                                            }}
                                          />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
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
