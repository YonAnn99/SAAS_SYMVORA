"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useLots } from "@/features/inventory";
import { LotDialog } from "@/features/inventory";
import { LotDeleteDialog } from "@/features/inventory";
import { LotsTable } from "@/features/inventory";

export default function LotsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const {
    lots,
    products,
    filteredLots,
    getProductName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingLot,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useLots(tenantId, tenantLoading);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Lotes con Caducidad
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona lotes de productos perecederos
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar lote
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de lote o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lots table */}
      <LotsTable
        lots={lots}
        filteredLots={filteredLots}
        loading={loading}
        getProductName={getProductName}
        onEdit={openEditDialog}
        onDelete={setDeleteConfirm}
        onAdd={openCreateDialog}
      />

      {/* Create/Edit Dialog */}
      <LotDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingLot={editingLot}
        products={products}
        saving={saving}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <LotDeleteDialog
        lot={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}