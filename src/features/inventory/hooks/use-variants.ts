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
import { useSucursal } from "@/contexts/sucursal-context";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import {
  conStockDeSucursalVariantes,
  destinoDeEdicionDeStock,
} from "@/features/sucursales/stock";
import {
  establecerStockSucursal,
  fetchStockSucursal,
} from "@/features/sucursales/services/stock-sucursal-service";

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

  // Mismo criterio que la pestaña de productos: con un local elegido, cada
  // talla muestra lo que hay EN ESE local.
  const { seleccionada, hayVarias, activas } = useSucursal();

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const [variantsData, productsData, stockLocal] = await Promise.all([
      fetchVariants(tenantId),
      fetchVariantProducts(tenantId),
      seleccionada ? fetchStockSucursal(seleccionada) : Promise.resolve(null),
    ]);
    setVariants(
      stockLocal ? conStockDeSucursalVariantes(variantsData, stockLocal) : variantsData
    );
    setProducts(productsData);
    setLoading(false);
  }, [tenantId, seleccionada]);

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

      // Con varias sucursales el stock de la talla es el DE UN LOCAL y viaja
      // aparte (ver el mismo razonamiento en `useProducts.handleSave`).
      const stock = Number(input.stock_actual ?? 0);
      let destinoStock: string | null = null;
      if (hayVarias) {
        if (editingVariant) {
          const destino = destinoDeEdicionDeStock(hayVarias, seleccionada);
          const cambio = stock !== Number(editingVariant.stock_actual);
          if (cambio && destino.tipo === "bloqueado") {
            toast.error(destino.motivo);
            return;
          }
          if (cambio && destino.tipo === "sucursal") destinoStock = destino.sucursalId;
        } else if (stock > 0) {
          destinoStock = destinoPorDefecto(seleccionada, activas);
          if (!destinoStock) {
            toast.error(
              "Elige en el selector a qué sucursal entran las existencias iniciales, o déjalas en 0."
            );
            return;
          }
        }
      }
      const datos: VarianteInput = hayVarias
        ? { ...input, stock_actual: editingVariant ? editingVariant.stock_actual : 0 }
        : input;

      setSaving(true);
      try {
        if (editingVariant) {
          // Se quita el stock del UPDATE en modo sucursales: reescribirlo, aun
          // igual, haria que la capa de compatibilidad (080) lo tomara como el
          // total del negocio.
          const { stock_actual: _omitido, ...sinStock } = datos;
          void _omitido;
          await updateVariant(
            editingVariant.id,
            (hayVarias ? sinStock : datos) as VarianteInput
          );
          if (destinoStock) {
            await establecerStockSucursal({
              sucursalId: destinoStock,
              productoId: editingVariant.producto_id,
              varianteId: editingVariant.id,
              cantidad: stock,
            });
          }
          await logActivity({
            action: "UPDATE",
            entity: "producto",
            entityId: editingVariant.id,
            entityName: `${input.talla || ""} ${input.color || ""}`.trim() || "Variante",
          });
          toast.success("Variante actualizada");
        } else {
          const nuevaId = await createVariant(tenantId, datos);
          if (destinoStock) {
            await establecerStockSucursal({
              sucursalId: destinoStock,
              productoId: datos.producto_id,
              varianteId: nuevaId,
              cantidad: stock,
            });
          }
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
    [tenantId, editingVariant, refetch, hayVarias, seleccionada, activas]
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