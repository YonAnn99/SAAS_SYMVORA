"use client";

import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search, Palette, Calendar, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useVariants,
  VariantDialog,
  VariantDeleteDialog,
  VariantsTable,
  useLots,
  LotDialog,
  LotDeleteDialog,
  LotsTable,
  useInventoryAdjustments,
  AdjustmentDialog,
  AdjustmentsTable,
} from "@/features/inventory";

interface InventorySectionProps {
  tenantId: string | null;
  tenantLoading: boolean;
}

function VariantsSection({ tenantId, tenantLoading }: InventorySectionProps) {
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por talla, color o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          Agregar variante
        </SpecularActionButton>
      </div>

      <VariantsTable
        variants={variants}
        filteredVariants={filteredVariants}
        loading={loading}
        getProductName={getProductName}
        onEdit={openEditDialog}
        onDelete={setDeleteConfirm}
        onAdd={openCreateDialog}
      />

      <VariantDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingVariant={editingVariant}
        products={products}
        saving={saving}
        onSave={handleSave}
      />

      <VariantDeleteDialog
        variant={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function LotsSection({ tenantId, tenantLoading }: InventorySectionProps) {
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de lote o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          Agregar lote
        </SpecularActionButton>
      </div>

      <LotsTable
        lots={lots}
        filteredLots={filteredLots}
        loading={loading}
        getProductName={getProductName}
        onEdit={openEditDialog}
        onDelete={setDeleteConfirm}
        onAdd={openCreateDialog}
      />

      <LotDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingLot={editingLot}
        products={products}
        saving={saving}
        onSave={handleSave}
      />

      <LotDeleteDialog
        lot={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AdjustmentsSection({ tenantId, tenantLoading }: InventorySectionProps) {
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por producto o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          Nuevo ajuste
        </SpecularActionButton>
      </div>

      <AdjustmentsTable
        adjustments={adjustments}
        filteredAdjustments={filteredAdjustments}
        loading={loading}
        getProductName={getProductName}
        onAdd={openCreateDialog}
      />

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

export function InventorySettingsTab({ tenantId, tenantLoading }: InventorySectionProps) {
  return (
    <Tabs defaultValue="variants" className="w-full">
      <TabsList>
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

      <TabsContent value="variants">
        <VariantsSection tenantId={tenantId} tenantLoading={tenantLoading} />
      </TabsContent>
      <TabsContent value="lots">
        <LotsSection tenantId={tenantId} tenantLoading={tenantLoading} />
      </TabsContent>
      <TabsContent value="adjustments">
        <AdjustmentsSection tenantId={tenantId} tenantLoading={tenantLoading} />
      </TabsContent>
    </Tabs>
  );
}
