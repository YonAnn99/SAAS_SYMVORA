"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Producto } from "../types/inventory.types";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
  type ProductInput,
} from "../services/product-service";

export function useProducts(tenantId: string | null, tenantLoading: boolean) {
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Producto | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const data = await fetchProducts(tenantId);
    setProducts(data);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setEditingProduct(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((product: Producto) => {
    setEditingProduct(product);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: ProductInput) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        if (editingProduct) {
          await updateProduct(editingProduct.id, input);
          toast.success("Producto actualizado");
        } else {
          await createProduct(tenantId, input);
          toast.success("Producto creado");
        }
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        const err = error as { code?: string; details?: string; hint?: string; message?: string } | Error;
        console.error("[createProduct] Supabase error:", {
          code: 'code' in err ? err.code : undefined,
          details: 'details' in err ? err.details : undefined,
          hint: 'hint' in err ? err.hint : undefined,
          message: err.message,
          fullError: err,
        });
        toast.error(
          error instanceof Error
            ? error.message
            : "Error al guardar el producto"
        );
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingProduct, refetch]
  );

  const handleDelete = useCallback(
    async (product: Producto) => {
      try {
        await deleteProduct(product.id);
        toast.success("Producto eliminado");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar el producto");
      }
    },
    [refetch]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.nombre.toLowerCase().includes(search.toLowerCase()) ||
          product.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
          product.sku?.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingProduct,
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