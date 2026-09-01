"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/supabase/activity-logger";
import type {
  Proveedor,
  PurchaseWithRelations,
} from "../types/inventory.types";
import {
  createPurchase,
  createSupplier,
  deletePurchase,
  fetchPurchases,
  fetchSuppliers,
  type PurchaseInput,
  type SupplierInput,
  updatePurchase,
  updatePurchaseStatus,
  updateSupplier,
} from "../services/purchase-service";

export function usePurchases(tenantId: string, tenantLoading: boolean) {
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPurchaseDialog, setShowNewPurchaseDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<PurchaseWithRelations | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Proveedor | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [purchasesData, suppliersData] = await Promise.all([
      fetchPurchases(tenantId),
      fetchSuppliers(tenantId),
    ]);
    setPurchases(purchasesData);
    setSuppliers(suppliersData);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const handleCreatePurchase = useCallback(
    async (input: PurchaseInput) => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !input.proveedorId || !tenantId) {
        toast.error("Faltan datos requeridos");
        return;
      }

      try {
        await createPurchase(tenantId, user.id, input);
        await logActivity({
          action: "CREATE",
          entity: "compra",
          entityName: `Compra ${input.numeroFactura || ""}`,
          details: { proveedor_id: input.proveedorId, total: input.total },
        });
        toast.success("Compra creada correctamente");
        setShowNewPurchaseDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al crear la compra: ${error.message}`
            : "Error al crear la compra"
        );
      }
    },
    [tenantId, refetch]
  );

  const openEditPurchase = useCallback((purchase: PurchaseWithRelations) => {
    setEditingPurchase(purchase);
    setShowNewPurchaseDialog(true);
  }, []);

  const handleUpdatePurchase = useCallback(
    async (purchaseId: string, input: PurchaseInput) => {
      if (!input.proveedorId) {
        toast.error("Faltan datos requeridos");
        return;
      }

      try {
        await updatePurchase(purchaseId, input);
        await logActivity({
          action: "UPDATE",
          entity: "compra",
          entityId: purchaseId,
          entityName: `Compra ${input.numeroFactura || ""}`,
          details: { proveedor_id: input.proveedorId, total: input.total },
        });
        toast.success("Compra actualizada correctamente");
        setShowNewPurchaseDialog(false);
        setEditingPurchase(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al actualizar la compra: ${error.message}`
            : "Error al actualizar la compra"
        );
      }
    },
    [refetch]
  );

  const handleCreateSupplier = useCallback(
    async (input: SupplierInput) => {
      if (!tenantId) {
        toast.error("No se pudo identificar el tenant");
        return;
      }

      try {
        await createSupplier(tenantId, input);
        await logActivity({
          action: "CREATE",
          entity: "proveedor",
          entityName: input.nombre,
          details: { email: input.email, telefono: input.phone },
        });
        toast.success("Proveedor creado correctamente");
        setShowNewSupplierDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al crear el proveedor: ${error.message}`
            : "Error al crear el proveedor"
        );
      }
    },
    [tenantId, refetch]
  );

  const openEditSupplier = useCallback((supplier: Proveedor) => {
    setEditingSupplier(supplier);
    setShowNewSupplierDialog(true);
  }, []);

  const handleUpdateSupplier = useCallback(
    async (supplierId: string, input: SupplierInput) => {
      try {
        await updateSupplier(supplierId, input);
        await logActivity({
          action: "UPDATE",
          entity: "proveedor",
          entityId: supplierId,
          entityName: input.nombre,
          details: { email: input.email, telefono: input.phone },
        });
        toast.success("Proveedor actualizado correctamente");
        setShowNewSupplierDialog(false);
        setEditingSupplier(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al actualizar el proveedor: ${error.message}`
            : "Error al actualizar el proveedor"
        );
      }
    },
    [refetch]
  );

  const handleUpdatePurchaseStatus = useCallback(
    async (
      purchaseId: string,
      estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA"
    ) => {
      try {
        await updatePurchaseStatus(purchaseId, estado);
        await logActivity({
          action: "UPDATE",
          entity: "compra",
          entityId: purchaseId,
          details: { nuevo_estado: estado },
        });
        toast.success(`Compra marcada como ${estado.toLowerCase()}`);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al actualizar estado: ${error.message}`
            : "Error al actualizar estado"
        );
      }
    },
    [refetch]
  );

  const handleDeletePurchase = useCallback(
    async (purchaseId: string) => {
      try {
        await deletePurchase(purchaseId);
        await logActivity({
          action: "DELETE",
          entity: "compra",
          entityId: purchaseId,
        });
        toast.success("Compra eliminada correctamente");
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Error al eliminar la compra: ${error.message}`
            : "Error al eliminar la compra"
        );
      }
    },
    [refetch]
  );

  const handlePurchaseDialogOpenChange = useCallback((open: boolean) => {
    setShowNewPurchaseDialog(open);
    if (!open) setEditingPurchase(null);
  }, []);

  const handleSupplierDialogOpenChange = useCallback((open: boolean) => {
    setShowNewSupplierDialog(open);
    if (!open) setEditingSupplier(null);
  }, []);

  return {
    purchases,
    suppliers,
    loading,
    showNewPurchaseDialog,
    setShowNewPurchaseDialog: handlePurchaseDialogOpenChange,
    editingPurchase,
    openEditPurchase,
    showNewSupplierDialog,
    setShowNewSupplierDialog: handleSupplierDialogOpenChange,
    editingSupplier,
    openEditSupplier,
    handleCreatePurchase,
    handleUpdatePurchase,
    handleCreateSupplier,
    handleUpdateSupplier,
    handleUpdatePurchaseStatus,
    handleDeletePurchase,
    refetch,
  };
}