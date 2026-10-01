"use client";

import { useModulos } from "@/hooks/use-modulos";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search, Package, Palette, Calendar, Wrench, SlidersHorizontal, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { useAccionRapida } from "@/hooks/use-accion-rapida";
import { useProducts } from "@/features/inventory";
import { ProductDialog } from "@/features/inventory";
import { ProductsTable } from "@/features/inventory";
import { QuickFilters } from "@/features/inventory";
import { ImportProductsDialog } from "@/features/inventory";
import { ProductsFilterDialog } from "@/features/inventory/components/products/products-filter-dialog";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
import { BarraProductosMovil } from "@/features/inventory/components/products/barra-productos-movil";
import { Button } from "@/components/ui/button";
import { LotsSection, AdjustmentsSection } from "@/features/inventory";
import { useVariants } from "@/features/inventory/hooks/use-variants";
import { VariantDialog } from "@/features/inventory/components/variants/variant-dialog";
import type { VarianteProducto } from "@/features/inventory/types/inventory.types";
import type { Producto } from "@/features/inventory";
import { SucursalSelector } from "@/features/sucursales/components/sucursal-selector";

export default function ProductsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const { can, loading: permsLoading } = usePermissions();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const {
    products,
    filteredProducts,
    search,
    setSearch,
    filters,
    setFilters,
    stockCounts,
    categories,
    sinCategoriaCount,
    activeFilterCount,
    loading,
    showDialog,
    setShowDialog,
    editingProduct,
    saving,
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleInlineSave,
    guardandoInline,
    favoritos,
    favoritosCount,
    sinMinimoCount,
    handleToggleFavorito,
    handleDelete,
  } = useProducts(tenantId, tenantLoading);

  // Variantes: ya no tienen pestaña propia. Se despliegan bajo su producto en
  // el catalogo (escritorio) o en una hoja (celular), y se crean desde
  // "Agregar producto -> Producto variante". Al cambiarlas se refrescan los
  // productos: el stock del padre puede cambiar.
  const variantes = useVariants(tenantId, tenantLoading, refetch);
  const variantesPorProducto = useMemo(() => {
    const mapa: Record<string, VarianteProducto[]> = {};
    for (const v of variantes.variants) (mapa[v.producto_id] ??= []).push(v);
    return mapa;
  }, [variantes.variants]);

  // Por PERMISO EFECTIVO, no por rol. Esta página se quedó atrás cuando el
  // sidebar y el middleware pasaron a permisos (migración 055): conceder
  // Inventario a un cajero guardaba el permiso pero las pestañas no aparecían,
  // porque aquí se seguía mirando `role`.
  const canImport = can("inventory.manage");

  // Variantes, Lotes y Ajustes son ORG_ADMIN+: antes vivían en /settings (que
  // es admin-only) y este movimiento NO amplía permisos. Lo respalda la
  // migración 053 en la base de datos — este gate solo evita enseñar pestañas
  // que no se pueden usar.
  const canManageInventory = can("inventory.manage");

  // Productos marcados para exportar "Solo seleccionados". Se conserva al
  // buscar o filtrar, para juntar productos de varias busquedas; al exportar se
  // cruza con `products`, asi un producto borrado se ignora solo.
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const productosSeleccionados = products.filter((p) => seleccionados.has(p.id));
  const toggleSeleccion = (id: string) =>
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  const seleccionarVisibles = (marcar: boolean) =>
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      for (const p of filteredProducts) {
        if (marcar) siguiente.add(p.id);
        else siguiente.delete(p.id);
      }
      return siguiente;
    });

  // No se pinta la barra hasta resolver el rol. Es la misma lección del fix
  // del sidebar (2026-09-04): calcular con `role` aún en null mostraba unos
  // cientos de ms el subconjunto equivocado. Aquí se verían pestañas que
  // desaparecen.
  const showInventoryTabs = !permsLoading && canManageInventory;

  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && ["lots", "adjustments"].includes(requestedTab)
      ? requestedTab
      : "catalog"
  );
  // Si el rol no da para inventario, cualquier ?tab= cae de vuelta al catálogo.
  // Modulos (Configuracion -> Modulos): sin variantes o sin lotes, su pestaña
  // no se ofrece. Los datos siguen ahi; al encenderlo vuelve la pestaña.
  const { modulos } = useModulos();
  const tabOculta = activeTab === "lots" && !modulos.permite_lotes_caducidad;
  const currentTab = showInventoryTabs && !tabOculta ? activeTab : "catalog";

  // "Agregar producto -> Producto variante" (y la busqueda rapida para lotes y
  // ajustes): pasa a la pestaña y le pide abrir su ventana de crear (el dialogo
  // y su hook viven alli). Solo se ofrece si la pestaña existe.
  const ofrecerVariante = showInventoryTabs && modulos.permite_variantes;
  const [pedidoCrear, setPedidoCrear] = useState<"lots" | "adjustments" | null>(null);
  const crearEnPestana = (pestana: "lots" | "adjustments") => {
    setActiveTab(pestana);
    setPedidoCrear(pestana);
  };
  // Sin pestaña de variantes: abre su ventana aqui mismo.
  const crearVariante = variantes.openCreateDialog;
  const pedidoAtendido = useCallback(() => setPedidoCrear(null), []);

  // Desde la busqueda rapida (Ctrl/Cmd+K).
  const listo = !loading && !permsLoading;
  useAccionRapida("agregar-producto", openCreateDialog, listo);
  useAccionRapida(
    "importar-catalogo",
    () => canImport && setShowImportDialog(true),
    listo
  );
  useAccionRapida(
    "agregar-variante",
    () => ofrecerVariante && crearVariante(),
    listo
  );
  useAccionRapida(
    "agregar-lote",
    () => showInventoryTabs && modulos.permite_lotes_caducidad && crearEnPestana("lots"),
    listo
  );
  useAccionRapida(
    "nuevo-ajuste",
    () => showInventoryTabs && crearEnPestana("adjustments"),
    listo
  );

  const exportColumns = [
    { header: "Nombre", accessor: (p: Producto) => p.nombre },
    {
      header: "Código de barras",
      accessor: (p: Producto) => p.codigo_barras || "-",
    },
    { header: "Unidad", accessor: (p: Producto) => p.unidad_medida },
    {
      header: "Precio de venta",
      accessor: (p: Producto) => `$${p.precio_venta.toFixed(2)}`,
    },
    { header: "Stock actual", accessor: (p: Producto) => p.stock_actual },
    { header: "Stock mínimo", accessor: (p: Producto) => p.stock_minimo },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("products.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tu catálogo de productos
          </p>
        </div>
        {/* En celular, cuadricula de 2x2 con los cuatro del mismo tamaño:
            arriba sucursal y Agregar producto (lo del dia), abajo Importar y
            Lista de precios. El orden visual sale de `order-*`; desde `sm`
            vuelve a ser una fila con el orden de siempre. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          {/* Con varias sucursales, la columna de existencias es la del local
              elegido aqui. No se dibuja en un negocio de un solo local. */}
          <SucursalSelector className="order-1 h-8 w-full sm:order-none sm:w-auto" />
          {/* Listas de precios: liquidaciones, mayoreo, precio de distribuidor.
              Va el primero porque es lo que menos se usa a diario; los dos de
              la derecha son los del trabajo del día. */}
          {canManageInventory && (
            <SpecularActionButton
              tone="money"
              className="order-4 h-8 w-full active:scale-[0.98] transition-transform sm:order-none sm:w-auto"
              onClick={() => router.push("/products/price-lists")}
            >
              Lista de precios
            </SpecularActionButton>
          )}
          {canImport && (
            <SpecularActionButton
              tone="add"
              className="order-3 h-8 w-full active:scale-[0.98] transition-transform sm:order-none sm:w-auto"
              onClick={() => setShowImportDialog(true)}
            >
              {t("products.import.title")}
            </SpecularActionButton>
          )}
          <span id="tutorial-add-product-btn" className="order-2 flex sm:order-none">
            {ofrecerVariante ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SpecularActionButton
                      tone="add"
                      className="h-8 w-full gap-1.5 active:scale-[0.98] transition-transform"
                    />
                  }
                >
                  {t("products.addProduct")}
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    className="cursor-pointer flex-col items-start gap-0.5"
                    onClick={openCreateDialog}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Package className="h-3.5 w-3.5" />
                      Producto único
                    </span>
                    <span className="pl-5.5 text-xs text-muted-foreground">
                      Un artículo con un solo precio y existencia
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex-col items-start gap-0.5"
                    onClick={crearVariante}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Palette className="h-3.5 w-3.5" />
                      Producto variante
                    </span>
                    <span className="pl-5.5 text-xs text-muted-foreground">
                      Tallas, colores o presentaciones de un producto
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SpecularActionButton
                tone="add"
                className="h-8 w-full active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                {t("products.addProduct")}
              </SpecularActionButton>
            )}
          </span>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
        {showInventoryTabs && (
          <TabsList className="mb-4">
            <TabsTrigger value="catalog" className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />
              Catálogo
            </TabsTrigger>
            {modulos.permite_lotes_caducidad && (
              <TabsTrigger value="lots" className="gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Lotes
              </TabsTrigger>
            )}
            <TabsTrigger value="adjustments" className="gap-1.5 text-xs">
              <Wrench className="h-3.5 w-3.5" />
              Ajustes
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="catalog" className="space-y-6 md:space-y-8">
      {/* Celular: busqueda + Filtros/CSV/PDF en un renglon y los filtros
          como etiquetas (Multi Select de beUI) en otro. La barra de abajo, de
          ~970 px en un solo renglon, desbordaba la pantalla. */}
      <div className="animate-fade-in-up stagger-2 md:hidden">
        <BarraProductosMovil
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          activeFilterCount={activeFilterCount}
          onAbrirFiltros={() => setShowFilters(true)}
          stockCounts={stockCounts}
          sinMinimoCount={sinMinimoCount}
          favoritosCount={favoritosCount}
          categories={categories}
          sinCategoriaCount={sinCategoriaCount}
          placeholderBusqueda={t("common.search")}
          exportar={
            <DataTableToolbar
              data={filteredProducts}
              columns={exportColumns}
              title="Productos"
              filename="productos"
              seleccion={productosSeleccionados}
              nombreFilas="productos"
            />
          }
        />
      </div>

      {/* Search + Export (tablet y escritorio) */}
      <div className="hidden items-center gap-2 animate-fade-in-up stagger-2 md:flex">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-9 h-8 text-sm"
          />
          {/* La busqueda ya filtra por codigo de barras: el leido se escribe ahi. */}
          <BotonEscanear modo="uno" titulo="Buscar por código" onCodigo={setSearch} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={() => setShowFilters(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="ml-0.5 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <DataTableToolbar
          data={filteredProducts}
          columns={exportColumns}
          title="Productos"
          filename="productos"
          seleccion={productosSeleccionados}
          nombreFilas="productos"
        />
        <QuickFilters
          filters={filters}
          onChange={setFilters}
          stockBajoCount={stockCounts.bajo}
          sinMinimoCount={sinMinimoCount}
          favoritosCount={favoritosCount}
        />
      </div>

      {/* Products table */}
      <ProductsTable
        products={products}
        filteredProducts={filteredProducts}
        loading={loading}
        onEdit={openEditDialog}
        onDelete={handleDelete}
        onAdd={openCreateDialog}
        onInlineSave={handleInlineSave}
        canEdit={canManageInventory}
        guardando={guardandoInline}
        favoritos={favoritos}
        onToggleFavorito={handleToggleFavorito}
        // Solo cuentan los que siguen existiendo (uno borrado deja de contar).
        seleccionados={new Set(productosSeleccionados.map((p) => p.id))}
        onToggleSeleccion={toggleSeleccion}
        onSeleccionarVisibles={seleccionarVisibles}
        onLimpiarSeleccion={() => setSeleccionados(new Set())}
        variantesPorProducto={variantesPorProducto}
        onEditVariante={variantes.openEditDialog}
        onDeleteVariante={variantes.handleDelete}
        variantesFavoritas={variantes.favoritas}
        onToggleFavoritaVariante={variantes.toggleFavorita}
        onInlineSaveVariante={variantes.handleInlineSaveVariante}
        guardandoVariantes={variantes.guardandoVariantes}
      />

        </TabsContent>

        {showInventoryTabs && (
          <>
            <TabsContent value="lots">
              <LotsSection
                tenantId={tenantId}
                tenantLoading={tenantLoading}
                abrirCrear={pedidoCrear === "lots"}
                onAbrirCrearAtendido={pedidoAtendido}
              />
            </TabsContent>
            <TabsContent value="adjustments">
              <AdjustmentsSection
                tenantId={tenantId}
                tenantLoading={tenantLoading}
                abrirCrear={pedidoCrear === "adjustments"}
                onAbrirCrearAtendido={pedidoAtendido}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Create/Edit Dialog */}
      {/* Crear / editar variante (antes vivia en su pestaña). */}
      <VariantDialog
        open={variantes.showDialog}
        onOpenChange={variantes.setShowDialog}
        editingVariant={variantes.editingVariant}
        products={variantes.products}
        variantes={variantes.variants}
        saving={variantes.saving}
        onSave={variantes.handleSave}
        onSaveMany={variantes.handleSaveMany}
      />

      <ProductDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingProduct={editingProduct}
        saving={saving}
        onSave={handleSave}
        tenantId={tenantId ?? ""}
        categorias={categories}
      />

      {/* Import Catalog Dialog */}
      {canImport && (
        <ImportProductsDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          tenantId={tenantId ?? ""}
          onImported={refetch}
        />
      )}

      <ProductsFilterDialog
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={setFilters}
        categories={categories}
        stockCounts={stockCounts}
        sinCategoriaCount={sinCategoriaCount}
      />
    </div>
  );
}