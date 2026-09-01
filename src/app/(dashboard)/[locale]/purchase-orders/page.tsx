"use client";

import { useState } from "react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  usePurchaseOrders,
  fetchOrderDetails,
} from "@/features/inventory";
import { PurchaseOrderDialog } from "@/features/inventory";
import { PurchaseOrderDeleteDialog } from "@/features/inventory";
import { PurchaseOrdersTable } from "@/features/inventory";
import type { DetalleOrdenCompra } from "@/features/inventory";

export default function PurchaseOrdersPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [editingDetails, setEditingDetails] = useState<DetalleOrdenCompra[]>(
    []
  );

  const {
    orders,
    suppliers,
    products,
    filteredOrders,
    getSupplierName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingOrder,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleStatusChange,
    handleDelete,
  } = usePurchaseOrders(tenantId, tenantLoading);

  const handleEdit = async (order: Parameters<typeof openEditDialog>[0]) => {
    const details = await fetchOrderDetails(order.id);
    setEditingDetails(details);
    openEditDialog(order);
  };

  const handleAdd = () => {
    setEditingDetails([]);
    openCreateDialog();
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Órdenes de Compra
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona órdenes de compra con flujo de estados
          </p>
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={handleAdd}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nueva orden
        </SpecularActionButton>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Orders table */}
      <PurchaseOrdersTable
        orders={orders}
        filteredOrders={filteredOrders}
        loading={loading}
        getSupplierName={getSupplierName}
        onEdit={handleEdit}
        onDelete={setDeleteConfirm}
        onAdd={handleAdd}
        onStatusChange={handleStatusChange}
      />

      {/* Create/Edit Dialog */}
      <PurchaseOrderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingOrder={editingOrder}
        initialDetails={editingDetails}
        suppliers={suppliers}
        products={products}
        existingOrders={orders}
        saving={saving}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <PurchaseOrderDeleteDialog
        order={deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}