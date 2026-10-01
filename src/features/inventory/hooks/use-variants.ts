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
import { etiquetaAtributos } from "../atributos-variante";
import { useSucursal } from "@/contexts/sucursal-context";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import {
  conStockDeSucursalVariantes,
  conStockSumadoVariantes,
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
  const { seleccionada, hayVarias, activas, restringido, permitidas } = useSucursal();

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const sumarSuyas = !seleccionada && restringido;
    const [variantsData, productsData, stockLocal] = await Promise.all([
      fetchVariants(tenantId),
      fetchVariantProducts(tenantId),
      seleccionada
        ? fetchStockSucursal(seleccionada)
        : sumarSuyas
          ? fetchStockSucursal(permitidas)
          : Promise.resolve(null),
    ]);
    setVariants(
      !stockLocal
        ? variantsData
        : sumarSuyas
          ? conStockSumadoVariantes(variantsData, stockLocal)
          : conStockDeSucursalVariantes(variantsData, stockLocal)
    );
    setProducts(productsData);
    setLoading(false);
  }, [tenantId, seleccionada, restringido, permitidas]);

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
      if (!tenantId) return false;

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
            return false;
          }
          if (cambio && destino.tipo === "sucursal") destinoStock = destino.sucursalId;
        } else if (stock > 0) {
          destinoStock = destinoPorDefecto(seleccionada, activas);
          if (!destinoStock) {
            toast.error(
              "Elige en el selector a qué sucursal entran las existencias iniciales, o déjalas en 0."
            );
            return false;
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
            entityName: etiquetaAtributos(input) || "Variante",
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
            entityName: etiquetaAtributos(input) || "Variante",
          });
          toast.success("Variante creada");
        }
        void refetch();
        // Cerrar lo decide el dialogo: al crear, tras la animacion.
        return true;
      } catch (error: unknown) {
        const isUnique = error instanceof Error && error.message.includes("23505");
        toast.error(
          isUnique
            ? "Ya existe una variante con esos atributos para este producto"
            : error instanceof Error
              ? "Error al guardar la variante"
              : "Error al guardar la variante"
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingVariant, refetch, hayVarias, seleccionada, activas]
  );

  /**
   * Varias variantes a la vez (una por combinacion de atributos). Mismas reglas
   * de stock por sucursal que `handleSave`; se detiene en la primera que falle
   * y dice cual, para no dejar a medias sin avisar.
   */
  const handleSaveMany = useCallback(
    async (inputs: VarianteInput[]) => {
      if (!tenantId || inputs.length === 0) return false;
      const hayStock = inputs.some((i) => Number(i.stock_actual ?? 0) > 0);
      let destinoStock: string | null = null;
      if (hayVarias && hayStock) {
        destinoStock = destinoPorDefecto(seleccionada, activas);
        if (!destinoStock) {
          toast.error(
            "Elige en el selector a qué sucursal entran las existencias iniciales, o déjalas en 0."
          );
          return false;
        }
      }

      setSaving(true);
      let creadas = 0;
      try {
        for (const input of inputs) {
          const stock = Number(input.stock_actual ?? 0);
          const datos: VarianteInput = hayVarias ? { ...input, stock_actual: 0 } : input;
          try {
            const nuevaId = await createVariant(tenantId, datos);
            if (destinoStock && stock > 0) {
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
              entityName: etiquetaAtributos(input) || "Variante",
            });
            creadas++;
          } catch (error: unknown) {
            const nombre = etiquetaAtributos(input) || "la variante";
            const duplicada = error instanceof Error
              ? error.message.includes("23505")
              : String((error as { code?: string })?.code) === "23505";
            toast.error(
              duplicada
                ? `"${nombre}" ya existe para este producto${creadas ? ` (se crearon ${creadas} antes)` : ""}`
                : `No se pudo crear "${nombre}"${creadas ? ` (se crearon ${creadas} antes)` : ""}`
            );
            if (creadas) void refetch();
            return false;
          }
        }
        toast.success(creadas === 1 ? "Variante creada" : `${creadas} variantes creadas`);
        void refetch();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [tenantId, hayVarias, seleccionada, activas, refetch]
  );

  const handleDelete = useCallback(
    async (variant: VarianteProducto) => {
      try {
        await deleteVariant(variant.id);
        await logActivity({
          action: "DELETE",
          entity: "producto",
          entityId: variant.id,
          entityName: etiquetaAtributos(variant) || "Variante",
        });
        toast.success("Variante eliminada");
        setDeleteConfirm(null);
        void refetch();
        return true;
      } catch {
        toast.error("Error al eliminar la variante");
        // La fila deslizable del celular se colapsa ANTES de borrar: con
        // `false` sabe que tiene que reaparecer.
        return false;
      }
    },
    [refetch]
  );

  const filteredVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          etiquetaAtributos(variant).toLowerCase().includes(search.toLowerCase()) ||
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
    handleSaveMany,
    handleDelete,
  };
}