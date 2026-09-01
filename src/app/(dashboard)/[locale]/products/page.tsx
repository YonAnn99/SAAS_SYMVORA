"use client";

import { useTranslations } from "next-intl";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useProducts } from "@/features/inventory";
import { ProductDialog } from "@/features/inventory";
import { ProductDeleteDialog } from "@/features/inventory";
import { ProductsTable } from "@/features/inventory";
import type { Producto } from "@/features/inventory";

export default function ProductsPage() {
  const t = useTranslations();
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
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
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useProducts(tenantId, tenantLoading);

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
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform w-full sm:w-auto"
          onClick={openCreateDialog}
        >

          {t("products.addProduct")}
        </SpecularActionButton>
      </div>

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
    </div>
  );
}