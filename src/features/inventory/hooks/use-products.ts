"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type { Producto } from "../types/inventory.types";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
  type ProductInput,
} from "../services/product-service";
import {
  EMPTY_FILTERS,
  applyProductFilters,
  countActiveFilters,
  countByStatus,
  type ProductFilters,
} from "@/features/inventory/stock-status";

export function useProducts(tenantId: string | null, tenantLoading: boolean) {
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
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
          await logActivity({
            action: "UPDATE",
            entity: "producto",
            entityId: editingProduct.id,
            entityName: input.nombre,
          });
          toast.success("Producto actualizado");
        } else {
          await createProduct(tenantId, input);
          await logActivity({
            action: "CREATE",
            entity: "producto",
            entityName: input.nombre,
          });
          toast.success("Producto creado");
        }
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
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
        await logActivity({
          action: "DELETE",
          entity: "producto",
          entityId: product.id,
          entityName: product.nombre,
        });
        toast.success("Producto eliminado");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar el producto");
      }
    },
    [refetch]
  );

  // Búsqueda y filtros se aplican EN CADENA, no se sustituyen: buscar "coca"
  // con el filtro "stock bajo" debe dar las cocas que están por acabarse.
  const searchedProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.nombre.toLowerCase().includes(search.toLowerCase()) ||
          product.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
          product.sku?.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  const filteredProducts = useMemo(
    () => applyProductFilters(searchedProducts, filters),
    [searchedProducts, filters]
  );

  // Los conteos de los chips salen del catálogo COMPLETO, no de lo ya
  // filtrado: si salieran de lo filtrado, marcar "stock bajo" pondría los
  // otros dos chips en cero y no se podría volver atrás con criterio.
  const stockCounts = useMemo(() => countByStatus(products), [products]);

  const categories = useMemo(
    () =>
      [...new Set(products.map((p) => p.categoria).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "es")
      ) as string[],
    [products]
  );

  const sinCategoriaCount = useMemo(
    () => products.filter((p) => !p.categoria).length,
    [products]
  );

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    filters,
    setFilters,
    stockCounts,
    categories,
    sinCategoriaCount,
    activeFilterCount,
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