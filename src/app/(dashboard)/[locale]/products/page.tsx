"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search, Package, Palette, Calendar, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { hasRole } from "@/lib/rbac";
import { useProducts } from "@/features/inventory";
import { ProductDialog } from "@/features/inventory";
import { ProductDeleteDialog } from "@/features/inventory";
import { ProductsTable } from "@/features/inventory";
import { ImportProductsDialog } from "@/features/inventory";
import {
  VariantsSection,
  LotsSection,
  AdjustmentsSection,
} from "@/features/inventory";
import type { Producto } from "@/features/inventory";

export default function ProductsPage() {
  const t = useTranslations();
  const { tenantId, role, loading: tenantLoading } = useCurrentTenant();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const {
    products,
    filteredProducts,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingProduct,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useProducts(tenantId, tenantLoading);

  const canImport = hasRole(role, "ORG_ADMIN");

  // Variantes, Lotes y Ajustes son ORG_ADMIN+: antes vivían en /settings (que
  // es admin-only) y este movimiento NO amplía permisos. Lo respalda la
  // migración 053 en la base de datos — este gate solo evita enseñar pestañas
  // que no se pueden usar.
  const canManageInventory = hasRole(role, "ORG_ADMIN");

  // No se pinta la barra hasta resolver el rol. Es la misma lección del fix
  // del sidebar (2026-09-04): calcular con `role` aún en null mostraba unos
  // cientos de ms el subconjunto equivocado. Aquí se verían pestañas que
  // desaparecen.
  const showInventoryTabs = !tenantLoading && canManageInventory;

  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && ["variants", "lots", "adjustments"].includes(requestedTab)
      ? requestedTab
      : "catalog"
  );
  // Si el rol no da para inventario, cualquier ?tab= cae de vuelta al catálogo.
  const currentTab = showInventoryTabs ? activeTab : "catalog";

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
        <div className="flex gap-2 w-full sm:w-auto">
          {canImport && (
            <SpecularActionButton
              tone="neutral"
              className="h-8 active:scale-[0.98] transition-transform flex-1 sm:flex-none"
              onClick={() => setShowImportDialog(true)}
            >
              {t("products.import.title")}
            </SpecularActionButton>
          )}
          <span id="tutorial-add-product-btn" className="flex flex-1 sm:flex-none">
            <SpecularActionButton
              tone="add"
              className="h-8 w-full active:scale-[0.98] transition-transform"
              onClick={openCreateDialog}
            >
              {t("products.addProduct")}
            </SpecularActionButton>
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
            <TabsTrigger value="variants" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" />
              Variantes
            </TabsTrigger>
            <TabsTrigger value="lots" className="gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Lotes
            </TabsTrigger>
            <TabsTrigger value="adjustments" className="gap-1.5 text-xs">
              <Wrench className="h-3.5 w-3.5" />
              Ajustes
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="catalog" className="space-y-6 md:space-y-8">
      {/* Search + Export */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <DataTableToolbar
          data={filteredProducts}
          columns={exportColumns}
          title="Productos"
          filename="productos"
        />
      </div>

      {/* Products table */}
      <ProductsTable
        products={products}
        filteredProducts={filteredProducts}
        loading={loading}
        onEdit={openEditDialog}
        onDelete={setDeleteConfirm}
        onAdd={openCreateDialog}
      />

        </TabsContent>

        {showInventoryTabs && (
          <>
            <TabsContent value="variants">
              <VariantsSection tenantId={tenantId} tenantLoading={tenantLoading} />
            </TabsContent>
            <TabsContent value="lots">
              <LotsSection tenantId={tenantId} tenantLoading={tenantLoading} />
            </TabsContent>
            <TabsContent value="adjustments">
              <AdjustmentsSection tenantId={tenantId} tenantLoading={tenantLoading} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Create/Edit Dialog */}
      <ProductDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingProduct={editingProduct}
        saving={saving}
        onSave={handleSave}
        tenantId={tenantId ?? ""}
      />

      {/* Delete Confirmation Dialog */}
      <ProductDeleteDialog
        product={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
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
    </div>
  );
}