"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type {
  Lote,
  ProductoOption,
} from "../types/inventory.types";
import {
  createLot,
  deleteLot,
  fetchLotProducts,
  fetchLots,
  updateLot,
  type LoteInput,
} from "../services/lot-service";

export function useLots(tenantId: string | null, tenantLoading: boolean) {
  const [lots, setLots] = useState<Lote[]>([]);
  const [products, setProducts] = useState<ProductoOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLot, setEditingLot] = useState<Lote | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Lote | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const [lotsData, productsData] = await Promise.all([
      fetchLots(tenantId),
      fetchLotProducts(tenantId),
    ]);
    setLots(lotsData);
    setProducts(productsData);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setEditingLot(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((lot: Lote) => {
    setEditingLot(lot);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: LoteInput) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        if (editingLot) {
          await updateLot(editingLot.id, input);
          await logActivity({
            action: "UPDATE",
            entity: "producto",
            entityId: editingLot.id,
            entityName: input.numero_lote || "Lote",
          });
          toast.success("Lote actualizado");
        } else {
          await createLot(tenantId, input);
          await logActivity({
            action: "CREATE",
            entity: "producto",
            entityName: input.numero_lote || "Lote",
          });
          toast.success("Lote creado");
        }
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        const isUnique = error instanceof Error && error.message.includes("23505");
        toast.error(
          isUnique
            ? "Ya existe un lote con ese número para este producto"
            : "Error al guardar el lote"
        );
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingLot, refetch]
  );

  const handleDelete = useCallback(
    async (lot: Lote) => {
      try {
        await deleteLot(lot.id);
        await logActivity({
          action: "DELETE",
          entity: "producto",
          entityId: lot.id,
          entityName: lot.numero_lote || "Lote",
        });
        toast.success("Lote eliminado");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar el lote");
      }
    },
    [refetch]
  );

  const getProductName = useCallback(
    (productId: string) =>
      products.find((p) => p.id === productId)?.nombre ||
      "Producto desconocido",
    [products]
  );

  const filteredLots = useMemo(
    () =>
      lots.filter(
        (lot) =>
          lot.numero_lote.toLowerCase().includes(search.toLowerCase()) ||
          getProductName(lot.producto_id).toLowerCase().includes(search.toLowerCase())
      ),
    [lots, search, getProductName]
  );

  return {
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
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  };
}