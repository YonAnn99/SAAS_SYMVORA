"use client";

import { useEffect } from "react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  useVariants,
  VariantDialog,
  VariantsTable,
  useLots,
  LotDialog,
  LotsTable,
  useInventoryAdjustments,
  AdjustmentDialog,
  AdjustmentsTable,
} from "@/features/inventory";

export interface InventorySectionProps {
  tenantId: string | null;
  tenantLoading: boolean;
  /**
   * Pide abrir la ventana de "crear" de la pestaña (lo usan "Agregar producto
   * -> Producto variante" y la busqueda rapida). Se atiende una vez y se avisa
   * con `onAbrirCrearAtendido`, para que no se reabra al volver a la pestaña.
   */
  abrirCrear?: boolean;
  onAbrirCrearAtendido?: () => void;
}

/** Atiende `abrirCrear`: abre el dialogo de crear y avisa a la pagina. */
function useAbrirCrearPedido(
  abrirCrear: boolean | undefined,
  abrir: () => void,
  onAtendido: (() => void) | undefined
) {
  useEffect(() => {
    if (!abrirCrear) return;
    abrir();
    onAtendido?.();
  }, [abrirCrear, abrir, onAtendido]);
}

export function VariantsSection({
  tenantId,
  tenantLoading,
  abrirCrear,
  onAbrirCrearAtendido,
}: InventorySectionProps) {
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
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useVariants(tenantId, tenantLoading);

  useAbrirCrearPedido(abrirCrear, openCreateDialog, onAbrirCrearAtendido);

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
        // Mantener presionado el boton de la fila ya es la confirmacion.
        onDelete={handleDelete}
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
    </div>
  );
}

export function LotsSection({
  tenantId,
  tenantLoading,
  abrirCrear,
  onAbrirCrearAtendido,
}: InventorySectionProps) {
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
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  } = useLots(tenantId, tenantLoading);

  useAbrirCrearPedido(abrirCrear, openCreateDialog, onAbrirCrearAtendido);

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
        onDelete={handleDelete}
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
    </div>
  );
}

export function AdjustmentsSection({
  tenantId,
  tenantLoading,
  abrirCrear,
  onAbrirCrearAtendido,
}: InventorySectionProps) {
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

  useAbrirCrearPedido(abrirCrear, openCreateDialog, onAbrirCrearAtendido);

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
