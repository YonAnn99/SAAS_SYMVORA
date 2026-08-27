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
  fetchTenantIdForUser,
  type PurchaseInput,
  type SupplierInput,
  updatePurchaseStatus,
} from "../services/purchase-service";

export function usePurchases() {
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewPurchaseDialog, setShowNewPurchaseDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);

  const refetch = useCallback(async () => {
    const resolvedTenantId = await fetchTenantIdForUser();
    if (!resolvedTenantId) {
      setLoading(false);
      return;
    }
    setTenantId(resolvedTenantId);
    const [purchasesData, suppliersData] = await Promise.all([
      fetchPurchases(resolvedTenantId),
      fetchSuppliers(resolvedTenantId),
    ]);
    setPurchases(purchasesData);
    setSuppliers(suppliersData);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [refetch]);

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

  return {
    purchases,
    suppliers,
    loading,
    showNewPurchaseDialog,
    setShowNewPurchaseDialog,
    showNewSupplierDialog,
    setShowNewSupplierDialog,
    handleCreatePurchase,
    handleCreateSupplier,
    handleUpdatePurchaseStatus,
    handleDeletePurchase,
    refetch,
  };
}