"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import { useSucursal } from "@/contexts/sucursal-context";
import type { ProductoOption } from "../types/inventory.types";
import {
  deleteLot,
  fetchLotProducts,
  fetchLots,
  fetchLotVariants,
  registrarLote,
  updateLot,
  type LoteConExistencias,
  type LoteEdicion,
  type LoteInput,
  type VarianteLoteOption,
} from "../services/lot-service";
import { existenciaEn } from "../lotes";
import { guardarCache, leerCache } from "@/lib/cache-datos";

interface DatosLotes {
  lotes: LoteConExistencias[];
  productos: ProductoOption[];
  variantes: VarianteLoteOption[];
}

/** El mensaje del servidor ya viene en espanol ("Solo hay 3 sin lote..."). */
function mensajeDeError(error: unknown, porDefecto: string, duplicado: string): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === "23505") return duplicado;
  return e?.message?.trim() || porDefecto;
}

export function useLots(tenantId: string | null, tenantLoading: boolean) {
  const { sucursales, seleccionada } = useSucursal();
  const t = useTranslations("products.lots");
  // Cache entre modulos (`lib/cache-datos.ts`).
  const [enCache] = useState(() => leerCache<DatosLotes>(["lotes", tenantId]));
  const [lots, setLots] = useState<LoteConExistencias[]>(() => enCache?.lotes ?? []);
  const [products, setProducts] = useState<ProductoOption[]>(() => enCache?.productos ?? []);
  const [variants, setVariants] = useState<VarianteLoteOption[]>(() => enCache?.variantes ?? []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !enCache);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLot, setEditingLot] = useState<LoteConExistencias | null>(null);
  const [verLote, setVerLote] = useState<LoteConExistencias | null>(null);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [lotsData, productsData, variantsData] = await Promise.all([
        fetchLots(tenantId),
        fetchLotProducts(tenantId),
        fetchLotVariants(tenantId),
      ]);
      setLots(lotsData);
      setProducts(productsData);
      setVariants(variantsData);
      guardarCache(["lotes", tenantId], {
        lotes: lotsData,
        productos: productsData,
        variantes: variantsData,
      });
    } catch {
      toast.error(t("msg.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setEditingLot(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((lot: LoteConExistencias) => {
    setEditingLot(lot);
    setShowDialog(true);
  }, []);

  const handleCreate = useCallback(
    async (input: LoteInput) => {
      setSaving(true);
      try {
        await registrarLote(input);
        await logActivity({
          action: "CREATE",
          entity: "producto",
          entityName: `Lote ${input.numero_lote.trim()}`,
        });
        toast.success(input.suma_stock ? t("msg.createdAdded") : t("msg.created"));
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(mensajeDeError(error, t("msg.saveError"), t("msg.duplicate")));
      } finally {
        setSaving(false);
      }
    },
    [refetch, t]
  );

  const handleUpdate = useCallback(
    async (input: LoteEdicion) => {
      if (!editingLot) return;
      setSaving(true);
      try {
        await updateLot(editingLot.id, input);
        await logActivity({
          action: "UPDATE",
          entity: "producto",
          entityId: editingLot.id,
          entityName: `Lote ${input.numero_lote.trim()}`,
        });
        toast.success(t("msg.updated"));
        setShowDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(mensajeDeError(error, t("msg.saveError"), t("msg.duplicate")));
      } finally {
        setSaving(false);
      }
    },
    [editingLot, refetch, t]
  );

  const handleDelete = useCallback(
    async (lot: LoteConExistencias) => {
      try {
        await deleteLot(lot.id);
        await logActivity({
          action: "DELETE",
          entity: "producto",
          entityId: lot.id,
          entityName: `Lote ${lot.numero_lote}`,
        });
        toast.success(t("msg.deleted"));
        void refetch();
      } catch (error: unknown) {
        toast.error(mensajeDeError(error, t("msg.deleteError"), t("msg.duplicate")));
      }
    },
    [refetch, t]
  );

  const getProductName = useCallback(
    (lot: Pick<LoteConExistencias, "producto_id" | "variante_id">) => {
      const nombre = products.find((p) => p.id === lot.producto_id)?.nombre ?? t("unknownProduct");
      if (!lot.variante_id) return nombre;
      const variante = variants.find((v) => v.id === lot.variante_id)?.etiqueta;
      return variante ? `${nombre} · ${variante}` : nombre;
    },
    [products, variants, t]
  );

  const nombreSucursal = useCallback(
    (id: string) => sucursales.find((s) => s.id === id)?.nombre ?? t("branch"),
    [sucursales, t]
  );

  // Con una sucursal elegida arriba, solo los lotes que tienen algo en ella
  // (los agotados se ven en "todas", para no perder su historial).
  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lots.filter((lot) => {
      if (seleccionada && existenciaEn(lot.existencias_lote, seleccionada) <= 0) return false;
      if (!q) return true;
      return (
        lot.numero_lote.toLowerCase().includes(q) ||
        getProductName(lot).toLowerCase().includes(q)
      );
    });
  }, [lots, search, seleccionada, getProductName]);

  return {
    lots,
    products,
    variants,
    filteredLots,
    getProductName,
    nombreSucursal,
    sucursalSeleccionada: seleccionada,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingLot,
    verLote,
    setVerLote,
    saving,
    refetch,
    openCreateDialog,
    openEditDialog,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
