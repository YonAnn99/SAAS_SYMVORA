"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/supabase/activity-logger";
import type {
  OrdenCompra,
  ProductOption,
} from "../types/inventory.types";
import {
  createOrder,
  deleteOrder,
  fetchOrderDetails,
  fetchOrderProducts,
  fetchOrders,
  fetchOrderSuppliers,
  orderEstadoLabels,
  updateOrder,
  updateOrderStatus,
  type OrderDetailItem,
} from "../services/purchase-order-service";

export interface OrdenSaveInput {
  proveedor_id: string;
  numero_orden: string;
  notas: string;
  items: { producto_id: string; cantidad_solicitada: string; costo_unitario: string }[];
}

export function usePurchaseOrders(
  tenantId: string | null,
  tenantLoading: boolean
) {
  const [orders, setOrders] = useState<OrdenCompra[]>([]);
  const [suppliers, setSuppliers] = useState<ProductOption[]>([]);
  const [products, setProducts] = useState<{
    id: string;
    nombre: string;
    costo_compra: number;
  }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenCompra | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrdenCompra | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const [ordersData, suppliersData, productsData] = await Promise.all([
      fetchOrders(tenantId),
      fetchOrderSuppliers(tenantId),
      fetchOrderProducts(tenantId),
    ]);
    setOrders(ordersData);
    setSuppliers(suppliersData);
    setProducts(productsData);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setEditingOrder(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback(async (order: OrdenCompra) => {
    setEditingOrder(order);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: OrdenSaveInput) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("No se pudo identificar el usuario");

        let subtotal = 0;
        input.items.forEach((item) => {
          subtotal +=
            parseFloat(item.cantidad_solicitada || "0") *
            parseFloat(item.costo_unitario || "0");
        });
        const impuesto = subtotal * 0.16;
        const total = subtotal + impuesto;

        const details: OrderDetailItem[] = input.items
          .filter((item) => item.producto_id)
          .map((item) => ({
            producto_id: item.producto_id,
            cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            subtotal:
              parseFloat(item.cantidad_solicitada || "0") *
              parseFloat(item.costo_unitario || "0"),
          }));

        const orderData = {
          proveedor_id: input.proveedor_id,
          numero_orden: input.numero_orden,
          subtotal,
          impuesto,
          total,
          notas: input.notas || null,
        };

        if (editingOrder) {
          await updateOrder(editingOrder.id, orderData, details);
          await logActivity({
            action: "UPDATE",
            entity: "orden_compra",
            entityId: editingOrder.id,
            entityName: input.numero_orden,
            details: { total, items: details.length },
          });
          toast.success("Orden actualizada");
        } else {
          await createOrder(tenantId, user.id, orderData, details);
          await logActivity({
            action: "CREATE",
            entity: "orden_compra",
            entityName: input.numero_orden,
            details: { proveedor_id: input.proveedor_id, total, items: details.length },
          });
          toast.success("Orden creada");
        }
        setShowDialog(false);
        void refetch();
      } catch {
        toast.error("Error al guardar la orden");
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingOrder, refetch]
  );

  const handleStatusChange = useCallback(
    async (order: OrdenCompra, newStatus: OrdenCompra["estado"]) => {
      try {
        await updateOrderStatus(order.id, newStatus);
        await logActivity({
          action: "UPDATE",
          entity: "orden_compra",
          entityId: order.id,
          entityName: order.numero_orden,
          details: { nuevo_estado: newStatus },
        });
        toast.success(`Orden marcada como ${orderEstadoLabels[newStatus]}`);
        void refetch();
      } catch {
        toast.error("Error al actualizar el estado");
      }
    },
    [refetch]
  );

  const handleDelete = useCallback(
    async (order: OrdenCompra) => {
      try {
        await deleteOrder(order.id);
        await logActivity({
          action: "DELETE",
          entity: "orden_compra",
          entityId: order.id,
          entityName: order.numero_orden,
        });
        toast.success("Orden eliminada");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar la orden");
      }
    },
    [refetch]
  );

  const getSupplierName = useCallback(
    (supplierId: string) =>
      suppliers.find((s) => s.id === supplierId)?.nombre ||
      "Proveedor desconocido",
    [suppliers]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.numero_orden.toLowerCase().includes(search.toLowerCase()) ||
          getSupplierName(order.proveedor_id)
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [orders, search, getSupplierName]
  );

  return {
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
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleStatusChange,
    handleDelete,
  };
}

export { fetchOrderDetails };