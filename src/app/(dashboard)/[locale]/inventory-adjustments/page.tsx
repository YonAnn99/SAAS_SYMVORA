"use client";

import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useInventoryAdjustments } from "@/features/inventory";
import { AdjustmentDialog } from "@/features/inventory";
import { AdjustmentsTable } from "@/features/inventory";

export default function InventoryAdjustmentsPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const {
    adjustments,
    products,
    variants,
    lots,
    filteredAdjustments,
    getProductName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    setSelectedProductId,
    saving,
    openCreateDialog,
    handleSave,
  } = useInventoryAdjustments(tenantId, tenantLoading);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Ajustes de Inventario
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registra ajustes de stock con motivo obligatorio
          </p>
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >

          Nuevo ajuste
        </SpecularActionButton>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Adjustments table */}
      <AdjustmentsTable
        adjustments={adjustments}
        filteredAdjustments={filteredAdjustments}
        loading={loading}
        getProductName={getProductName}
        onAdd={openCreateDialog}
      />

      {/* Create Dialog */}
      <AdjustmentDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        products={products}
        variants={variants}
        lots={lots}
        saving={saving}
        onProductChange={setSelectedProductId}
        onSave={handleSave}
      />
    </div>
  );
}