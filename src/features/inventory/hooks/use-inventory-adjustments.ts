"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  AjusteInventario,
  LoteOption,
  ProductOption,
  VarianteOption,
} from "../types/inventory.types";
import {
  createAdjustment,
  fetchAdjustmentProducts,
  fetchAdjustments,
  fetchProductLots,
  fetchProductVariants,
  type AjusteInput,
} from "../services/inventory-adjustment-service";

export function useInventoryAdjustments(
  tenantId: string | null,
  tenantLoading: boolean
) {
  const [adjustments, setAdjustments] = useState<AjusteInventario[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<VarianteOption[]>([]);
  const [lots, setLots] = useState<LoteOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const [adjustmentsData, productsData] = await Promise.all([
      fetchAdjustments(tenantId),
      fetchAdjustmentProducts(tenantId),
    ]);
    setAdjustments(adjustmentsData);
    setProducts(productsData);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const loadProductOptions = useCallback(
    async (productoId: string) => {
      if (!tenantId) {
        setVariants([]);
        setLots([]);
        return;
      }
      const [variantsData, lotsData] = await Promise.all([
        fetchProductVariants(tenantId, productoId),
        fetchProductLots(tenantId, productoId),
      ]);
      setVariants(variantsData);
      setLots(lotsData);
    },
    [tenantId]
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadProductOptions(selectedProductId),
      0
    );
    return () => window.clearTimeout(timeout);
  }, [selectedProductId, loadProductOptions]);

  const openCreateDialog = useCallback(() => {
    setSelectedProductId("");
    setVariants([]);
    setLots([]);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: AjusteInput) => {
      setSaving(true);
      try {
        await createAdjustment(input);
        toast.success("Inventario ajustado correctamente");
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Error al ajustar inventario"
        );
      } finally {
        setSaving(false);
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

  const filteredAdjustments = useMemo(
    () =>
      adjustments.filter(
        (adj) =>
          getProductName(adj.producto_id).toLowerCase().includes(search.toLowerCase()) ||
          adj.motivo.toLowerCase().includes(search.toLowerCase())
      ),
    [adjustments, search, getProductName]
  );

  return {
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
    selectedProductId,
    setSelectedProductId,
    saving,
    refetch,
    openCreateDialog,
    handleSave,
  };
}