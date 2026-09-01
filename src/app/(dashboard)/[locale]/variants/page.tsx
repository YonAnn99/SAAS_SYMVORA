"use client";

import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useVariants } from "@/features/inventory";
import { VariantDialog } from "@/features/inventory";
import { VariantDeleteDialog } from "@/features/inventory";
import { VariantsTable } from "@/features/inventory";

export default function VariantsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const {
    variants,
    products,
    filteredVariants,
    getProductName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingVariant,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useVariants(tenantId, tenantLoading);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Variantes de Producto
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tallas, colores y otras variantes de tus productos
          </p>
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >

          Agregar variante
        </SpecularActionButton>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por talla, color o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Variants table */}
      <VariantsTable
        variants={variants}
        filteredVariants={filteredVariants}
        loading={loading}
        getProductName={getProductName}
        onEdit={openEditDialog}
        onDelete={setDeleteConfirm}
        onAdd={openCreateDialog}
      />

      {/* Create/Edit Dialog */}
      <VariantDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingVariant={editingVariant}
        products={products}
        saving={saving}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <VariantDeleteDialog
        variant={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}