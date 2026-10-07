"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useModulos } from "@/hooks/use-modulos";
import Image from "next/image";
import { Archive, ChevronRight, Layers, Package, Pencil, Plus } from "lucide-react";
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
import { rangoDePrecio, resumenConVariantes } from "@/features/inventory/resumen-variantes";
import { ProductSwipeList } from "./product-swipe-list";

interface ProductsTableProps {
  products: Producto[];
  filteredProducts: Producto[];
  loading: boolean;
  onEdit: (product: Producto) => void;
  /** `false` si no se pudo borrar (la fila deslizable del celular reaparece). */
  onDelete: (product: Producto) => void | Promise<boolean | void>;
  /** Archivar a mano (sale del catalogo y del POS). `false` si no se archivo. */
  onArchive?: (product: Producto) => Promise<boolean>;
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
  /** Corazones por variante del usuario actual. */
  variantesFavoritas?: ReadonlySet<string>;
  onToggleFavoritaVariante?: (variante: VarianteProducto) => void;
  /** Edicion en la celda de una variante (precio o stock). */
  onInlineSaveVariante?: (
    variante: VarianteProducto,
    campo: "precio_venta" | "stock_actual",
    texto: string
  ) => void | Promise<void>;
  /** Ids de variantes con un guardado en vuelo. */
  guardandoVariantes?: ReadonlySet<string>;
  /** Abre la ventana para crear variantes de este producto. */
  onAgregarVariante?: (product: Producto) => void;
}

export function ProductsTable({
  products,
  filteredProducts,
  loading,
  onEdit,
  onDelete,
  onArchive,
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
  variantesFavoritas = new Set<string>(),
  onToggleFavoritaVariante,
  onInlineSaveVariante,
  guardandoVariantes = new Set<string>(),
  onAgregarVariante,
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
  // "+ Agregar variante": con permiso y el modulo de variantes encendido. Un
  // servicio solo si ya es "producto con variantes" (Corte chico / grande).
  const puedeAgregarVariante = (p: Producto) =>
    canEdit &&
    Boolean(onAgregarVariante) &&
    modulos.permite_variantes &&
    (!p.es_servicio || p.permite_variantes);
  // Misma celda editable que los productos, para precio y stock de variante.
  const celdaVariante = (v: VarianteProducto, campo: "precio_venta" | "stock_actual") => ({
    canEdit: canEdit && Boolean(onInlineSaveVariante),
    saving: guardandoVariantes.has(v.id),
    hint: t("products.inlineEditHint"),
    value: String(v[campo]),
    onCommit: (texto: string) => void onInlineSaveVariante?.(v, campo, texto),
  });
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
              onArchive={canEdit ? onArchive : undefined}
              conteoVariantes={conteoVariantes}
              variantesPorProducto={variantesPorProducto}
              onVerVariantes={(p) => setHojaDe(p.id)}
            />
            <VariantesProductoHoja
              producto={productoHoja}
              variantes={hojaDe ? variantesPorProducto[hojaDe] ?? [] : []}
              onOpenChange={(abierta) => !abierta && setHojaDe(null)}
              onEdit={(v) => onEditVariante?.(v)}
              onDelete={async (v) => (onDeleteVariante ? onDeleteVariante(v) : false)}
              onAgregar={
                productoHoja && puedeAgregarVariante(productoHoja)
                  ? () => {
                      setHojaDe(null);
                      onAgregarVariante?.(productoHoja);
                    }
                  : undefined
              }
              favoritas={variantesFavoritas}
              onToggleFavorita={onToggleFavoritaVariante}
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
                    {t("products.description")}
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
                  // Con variantes, la fila es el "producto general": precio,
                  // stock y estado salen de sus variantes (ver resumen).
                  const resumen =
                    variantes.length > 0 ? resumenConVariantes(product, variantes) : null;
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
                    {/* Descripcion: solo lectura (se cambia en Editar). Una
                        linea; el texto completo sale al pasar el cursor. */}
                    <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                      {product.descripcion?.trim() ? (
                        <span className="block truncate" title={product.descripcion}>
                          {product.descripcion}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
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
                      {resumen ? (
                        // El rango de sus variantes. No se edita aqui: el
                        // precio del padre no se cobra (se elige variante).
                        <span className="whitespace-nowrap tabular-nums">{rangoDePrecio(resumen)}</span>
                      ) : (
                        <EditableTextCell
                          {...celda("precio_venta")}
                          numerico
                          className="text-right font-mono tabular-nums"
                        >
                          ${product.precio_venta.toFixed(2)}
                        </EditableTextCell>
                      )}
                    </TableCell>
                    {/* Margen y Estado no se editan porque NO SON COLUMNAS: se
                        calculan a partir del precio, el costo y el stock
                        minimo, y se recalculan solos al editar los de al lado. */}
                    <TableCell className="text-right text-sm font-mono">
                      {resumen ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ProductMarginCell product={product} />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {/* Un servicio no tiene existencias, así que no se muestra
                          un número ni se deja editar: teclear ahí no cambiaría
                          nada, porque la venta ya no le descuenta stock. */}
                      {product.es_servicio ? (
                        <span className="text-muted-foreground">—</span>
                      ) : resumen ? (
                        // Total: el propio (si tiene) + sus variantes. Se
                        // edita en cada variante.
                        <span className="tabular-nums" title="Suma de sus variantes">
                          {resumen.stockTotal}
                        </span>
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
                      <StockBadge product={product} estado={resumen?.estado} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <FavoriteButton
                          esFavorito={favoritos.has(product.id)}
                          onToggle={() => onToggleFavorito(product)}
                          nombre={product.nombre}
                        />
                        {/* Sin variantes todavia: convertirlo en producto con
                            variantes. Con variantes, la fila "+ Agregar
                            variante" va al final de las desplegadas. */}
                        {variantes.length === 0 && puedeAgregarVariante(product) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => onAgregarVariante?.(product)}
                            title="Agregar variantes"
                            aria-label={`Agregar variantes a ${product.nombre}`}
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onEdit(product)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          {t("common.edit")}
                        </Button>
                        {canEdit && onArchive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => void onArchive(product)}
                            title="Archivar"
                            aria-label={`Archivar ${product.nombre}`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                  {/* Variantes: filas de la MISMA tabla, alineadas con las
                      columnas del producto (codigo, precio, margen, stock,
                      estado y acciones). Se pliegan celda por celda: el alto
                      de una fila de tabla no se puede animar. */}
                  {variantes.map((v, i) => (
                    <TableRow
                      key={v.id}
                      inert={!abierto || undefined}
                      aria-hidden={!abierto || undefined}
                      className={
                        abierto
                          ? "bg-muted/20 hover:bg-muted/40"
                          : "border-0 hover:bg-transparent"
                      }
                    >
                      <CeldaPlegable abierta={abierto} className="w-8" />
                      <CeldaPlegable abierta={abierto}>
                        <div id={i === 0 ? idPanel : undefined} className="flex items-center gap-2 pl-[54px] text-[13px]">
                          <span className="text-muted-foreground/60" aria-hidden="true">└</span>
                          {v.imagen_url && (
                            <Image
                              src={v.imagen_url}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 shrink-0 rounded border border-border object-cover"
                            />
                          )}
                          <AtributosVariante variant={v} vacio="Sin atributos" />
                        </div>
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="max-w-[220px] text-[13px] text-muted-foreground">
                        {v.descripcion?.trim() ? (
                          <span className="block truncate" title={v.descripcion}>
                            {v.descripcion}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="text-[13px] font-mono text-muted-foreground">
                        {v.codigo_barras || "-"}
                      </CeldaPlegable>
                      {/* La suya si la tiene (migracion 104); si no, la del
                          producto, en gris. Se cambia en "Editar" de la variante. */}
                      <CeldaPlegable
                        abierta={abierto}
                        className={`text-[13px] ${v.unidad_medida ? "" : "text-muted-foreground"}`}
                      >
                        {t(`products.units.${v.unidad_medida ?? product.unidad_medida}`)}
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="text-right text-[13px] font-mono">
                        <EditableTextCell
                          {...celdaVariante(v, "precio_venta")}
                          numerico
                          className="text-right font-mono tabular-nums"
                        >
                          ${v.precio_venta.toFixed(2)}
                        </EditableTextCell>
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="text-right text-[13px] font-mono">
                        <ProductMarginCell
                          product={{ precio_venta: v.precio_venta, costo_compra: v.costo_compra }}
                        />
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="text-right text-[13px] font-mono tabular-nums">
                        <EditableTextCell
                          {...celdaVariante(v, "stock_actual")}
                          numerico
                          className="text-right font-mono tabular-nums"
                        >
                          {v.stock_actual}
                        </EditableTextCell>
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto}>
                        <StockBadge
                          // Su propio minimo (migracion 103), no el del producto.
                          product={{ stock_actual: v.stock_actual, stock_minimo: v.stock_minimo ?? 0 }}
                        />
                      </CeldaPlegable>
                      <CeldaPlegable abierta={abierto} className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <FavoriteButton
                            esFavorito={variantesFavoritas.has(v.id)}
                            onToggle={() => onToggleFavoritaVariante?.(v)}
                            nombre={`${product.nombre} ${etiquetaAtributos(v)}`.trim()}
                          />
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
                      </CeldaPlegable>
                    </TableRow>
                  ))}
                  {variantes.length > 0 && puedeAgregarVariante(product) && (
                    <TableRow
                      inert={!abierto || undefined}
                      aria-hidden={!abierto || undefined}
                      className={abierto ? "bg-muted/20 hover:bg-muted/20" : "border-0 hover:bg-transparent"}
                    >
                      <CeldaPlegable abierta={abierto} className="w-8" />
                      <CeldaPlegable abierta={abierto} colSpan={9}>
                        <div className="pl-[54px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-[#1e3a8a] hover:text-[#1e3a8a] dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => onAgregarVariante?.(product)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar variante
                          </Button>
                        </div>
                      </CeldaPlegable>
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
/**
 * Celda de una fila de variante que se pliega: el mismo despliegue de
 * `accordion.tsx` (grid-template-rows 0fr -> 1fr) con el relleno POR DENTRO,
 * asi plegada mide 0 de alto aunque sea una celda de tabla.
 */
function CeldaPlegable({
  abierta,
  className,
  colSpan,
  children,
}: {
  abierta: boolean;
  className?: string;
  colSpan?: number;
  children?: ReactNode;
}) {
  return (
    <TableCell className="p-0 align-middle" colSpan={colSpan}>
      <div
        style={{
          display: "grid",
          gridTemplateRows: abierta ? "1fr" : "0fr",
          opacity: abierta ? 1 : 0,
          transition: "grid-template-rows 0.3s ease, opacity 0.2s ease",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`px-2 py-1.5 ${className ?? ""}`}>{children}</div>
        </div>
      </div>
    </TableCell>
  );
}

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
