"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type {
  ProductoOption,
  VarianteProducto,
} from "../types/inventory.types";
import {
  createVariant,
  deleteVariant,
  fetchVariantProducts,
  fetchVariants,
  updateVariant,
  type VarianteInput,
} from "../services/variant-service";

export function useVariants(tenantId: string | null, tenantLoading: boolean) {
  const [variants, setVariants] = useState<VarianteProducto[]>([]);
  const [products, setProducts] = useState<ProductoOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VarianteProducto | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<VarianteProducto | null>(
    null
  );

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const [variantsData, productsData] = await Promise.all([
      fetchVariants(tenantId),
      fetchVariantProducts(tenantId),
    ]);
    setVariants(variantsData);
    setProducts(productsData);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setEditingVariant(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((variant: VarianteProducto) => {
    setEditingVariant(variant);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: VarianteInput) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        if (editingVariant) {
          await updateVariant(editingVariant.id, input);
          await logActivity({
            action: "UPDATE",
            entity: "producto",
            entityId: editingVariant.id,
            entityName: `${input.talla || ""} ${input.color || ""}`.trim() || "Variante",
          });
          toast.success("Variante actualizada");
        } else {
          await createVariant(tenantId, input);
          await logActivity({
            action: "CREATE",
            entity: "producto",
            entityName: `${input.talla || ""} ${input.color || ""}`.trim() || "Variante",
          });
          toast.success("Variante creada");
        }
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        const isUnique = error instanceof Error && error.message.includes("23505");
        toast.error(
          isUnique
            ? "Ya existe una variante con esa talla y color para este producto"
            : error instanceof Error
              ? "Error al guardar la variante"
              : "Error al guardar la variante"
        );
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingVariant, refetch]
  );

  const handleDelete = useCallback(
    async (variant: VarianteProducto) => {
      try {
        await deleteVariant(variant.id);
        await logActivity({
          action: "DELETE",
          entity: "producto",
          entityId: variant.id,
          entityName: `${variant.talla || ""} ${variant.color || ""}`.trim() || "Variante",
        });
        toast.success("Variante eliminada");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar la variante");
      }
    },
    [refetch]
  );

  const filteredVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant.talla?.toLowerCase().includes(search.toLowerCase()) ||
          variant.color?.toLowerCase().includes(search.toLowerCase()) ||
          variant.sku?.toLowerCase().includes(search.toLowerCase())
      ),
    [variants, search]
  );

  const getProductName = useCallback(
    (productId: string) =>
      products.find((p) => p.id === productId)?.nombre ||
      "Producto desconocido",
    [products]
  );

  return {
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
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleDelete,
  };
}