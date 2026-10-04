"use client";

import { useState } from "react";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useAccionRapida } from "@/hooks/use-accion-rapida";
import {
  usePurchaseOrders,
  fetchOrderDetails,
} from "@/features/inventory";
import { PurchaseOrderDialog } from "@/features/inventory";
import { PurchaseOrdersTable } from "@/features/inventory";
import { ReceiveOrderDialog } from "@/features/inventory";
import { PurchaseOrderDetailDialog } from "@/features/inventory";
import { etiquetaVariante } from "@/features/inventory/purchase-order-items";
import type { DetalleOrdenCompra } from "@/features/inventory";
import { EncabezadoModulo } from "@/components/dashboard/encabezado-modulo";

export default function PurchaseOrdersPage() {
  const { tenantId, tenantName, loading: tenantLoading } = useCurrentTenant();
  const [editingDetails, setEditingDetails] = useState<DetalleOrdenCompra[]>(
    []
  );

  const {
    orders,
    suppliers,
    products,
    variants,
    filteredOrders,
    getSupplierName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingOrder,
    saving,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleStatusChange,
    handleDelete,
    receivingOrder,
    receivingDetails,
    receiving,
    openReceiveDialog,
    closeReceiveDialog,
    handleReceive,
    handleWhatsApp,
    enviandoId,
  } = usePurchaseOrders(tenantId, tenantLoading, tenantName ?? undefined);
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null);

  const handleEdit = async (order: Parameters<typeof openEditDialog>[0]) => {
    const details = await fetchOrderDetails(order.id);
    setEditingDetails(details);
    openEditDialog(order);
  };

  const handleAdd = () => {
    setEditingDetails([]);
    openCreateDialog();
  };

  // Desde la busqueda rapida (Ctrl/Cmd+K).
  useAccionRapida("nueva-orden", handleAdd, !loading);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <EncabezadoModulo
            titulo="Órdenes de Compra"
            descripcion="Gestiona órdenes de compra con flujo de estados"
          />
        </div>
        <SpecularActionButton
          tone="add"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={handleAdd}
        >

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
        // Mantener presionado el boton de la fila ya es la confirmacion.
        onDelete={handleDelete}
        onAdd={handleAdd}
        onStatusChange={handleStatusChange}
        onReceive={(order) => void openReceiveDialog(order)}
        onWhatsApp={(order) => void handleWhatsApp(order)}
        enviandoId={enviandoId}
        onOpen={(order) => setOrdenAbierta(order.id)}
        getSupplierPhone={(id) =>
          suppliers.find((s) => s.id === id)?.telefono ?? null
        }
      />

      {/* Recepción de mercancía */}
      {/* Desglose de una orden (clic en la fila). */}
      <PurchaseOrderDetailDialog
        ordenId={ordenAbierta}
        tenantId={tenantId ?? ""}
        nombreNegocio={tenantName || "nuestro negocio"}
        onOpenChange={(open) => !open && setOrdenAbierta(null)}
      />

      <ReceiveOrderDialog
        open={receivingOrder !== null}
        onOpenChange={(open) => !open && closeReceiveDialog()}
        order={receivingOrder}
        details={receivingDetails}
        nombreProducto={(id, varianteId) => {
          const base = products.find((p) => p.id === id)?.nombre ?? "Producto";
          if (!varianteId) return base;
          const v = variants.find((v) => v.id === varianteId);
          // Sin el sufijo, dos renglones de la misma prenda en distinta talla
          // se verían idénticos y no se sabría en cuál escribir.
          return v ? `${base} · ${etiquetaVariante(v)}` : base;
        }}
        saving={receiving}
        onConfirm={handleReceive}
      />

      {/* Create/Edit Dialog */}
      <PurchaseOrderDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editingOrder={editingOrder}
        initialDetails={editingDetails}
        suppliers={suppliers}
        products={products}
        variants={variants}
        existingOrders={orders}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}