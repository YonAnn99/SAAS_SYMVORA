"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { mensajeDeError } from "@/features/inventory/error-message";
import {
  addItemsToPriceList,
  createPriceList,
  deletePriceList,
  fetchPriceList,
  fetchPriceListItems,
  fetchPriceLists,
  removeItemFromPriceList,
  setPriceListActive,
  updatePriceListPrices,
  type ListaConConteo,
  type ListaPrecios,
  type PrecioLista,
  type PrecioActualizado,
  type RenglonNuevo,
} from "../services/price-list-service";

/** El índice: las tarjetas de todas las listas del negocio. */
export function usePriceLists(tenantId: string | null, tenantLoading: boolean) {
  const [listas, setListas] = useState<ListaConConteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    try {
      setListas(await fetchPriceLists(tenantId));
    } catch (error: unknown) {
      toast.error(mensajeDeError(error));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Diferido, como en el resto del proyecto: un setState síncrono dentro de un
  // efecto encadena renders y dispara `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (tenantLoading) return;
    const t = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(t);
  }, [tenantLoading, refetch]);

  const crear = useCallback(
    async (nombre: string): Promise<ListaPrecios | null> => {
      if (!tenantId) return null;
      setSaving(true);
      try {
        const lista = await createPriceList(tenantId, nombre.trim());
        void refetch();
        return lista;
      } catch (error: unknown) {
        toast.error(mensajeDeError(error));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [tenantId, refetch]
  );

  const alternarActiva = useCallback(
    async (lista: ListaConConteo) => {
      // Optimista: es un interruptor, esperar a la red lo haría sentirse lento.
      setListas((prev) =>
        prev.map((l) => (l.id === lista.id ? { ...l, activa: !l.activa } : l))
      );
      try {
        await setPriceListActive(lista.id, !lista.activa);
      } catch (error: unknown) {
        setListas((prev) =>
          prev.map((l) => (l.id === lista.id ? { ...l, activa: lista.activa } : l))
        );
        toast.error(mensajeDeError(error));
      }
    },
    []
  );

  const eliminar = useCallback(
    async (lista: ListaConConteo) => {
      try {
        await deletePriceList(lista.id);
        toast.success("Lista eliminada");
        void refetch();
      } catch (error: unknown) {
        toast.error(mensajeDeError(error));
      }
    },
    [refetch]
  );

  return { listas, loading, saving, refetch, crear, alternarActiva, eliminar };
}

/** El detalle: los renglones de UNA lista. */
export function usePriceList(listaId: string | null) {
  const [lista, setLista] = useState<ListaPrecios | null>(null);
  const [items, setItems] = useState<PrecioLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!listaId) return;
    try {
      const [cabecera, renglones] = await Promise.all([
        fetchPriceList(listaId),
        fetchPriceListItems(listaId),
      ]);
      setLista(cabecera);
      setItems(renglones);
    } catch (error: unknown) {
      toast.error(mensajeDeError(error));
    } finally {
      setLoading(false);
    }
  }, [listaId]);

  useEffect(() => {
    const t = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(t);
  }, [refetch]);

  const agregar = useCallback(
    async (renglones: RenglonNuevo[]) => {
      if (!listaId) return;
      setSaving(true);
      try {
        await addItemsToPriceList(listaId, renglones);
        toast.success(
          renglones.length === 1
            ? "Producto agregado a la lista"
            : `${renglones.length} productos agregados a la lista`
        );
        await refetch();
      } catch (error: unknown) {
        toast.error(mensajeDeError(error));
      } finally {
        setSaving(false);
      }
    },
    [listaId, refetch]
  );

  const quitar = useCallback(
    async (productoId: string, varianteId: string | null) => {
      if (!listaId) return;
      const antes = items;
      setItems((prev) =>
        prev.filter(
          (i) => !(i.producto_id === productoId && i.variante_id === varianteId)
        )
      );
      try {
        await removeItemFromPriceList(listaId, productoId, varianteId);
      } catch (error: unknown) {
        setItems(antes);
        toast.error(mensajeDeError(error));
      }
    },
    [listaId, items]
  );

  const guardarPrecios = useCallback(
    async (cambios: PrecioActualizado[]) => {
      if (!listaId || cambios.length === 0) return;
      const antes = items;
      // Optimista: el botón de porcentaje puede tocar decenas de filas y
      // esperar a la red dejaría la tabla congelada.
      setItems((prev) =>
        prev.map((i) => {
          const c = cambios.find(
            (x) => x.producto_id === i.producto_id && x.variante_id === i.variante_id
          );
          return c ? { ...i, precio: c.precio } : i;
        })
      );
      setSaving(true);
      try {
        await updatePriceListPrices(listaId, cambios);
      } catch (error: unknown) {
        setItems(antes);
        toast.error(mensajeDeError(error));
      } finally {
        setSaving(false);
      }
    },
    [listaId, items]
  );

  const activar = useCallback(
    async (activa: boolean) => {
      if (!listaId) return;
      try {
        await setPriceListActive(listaId, activa);
        setLista((prev) => (prev ? { ...prev, activa } : prev));
        toast.success(activa ? "Lista activada" : "Lista desactivada");
      } catch (error: unknown) {
        toast.error(mensajeDeError(error));
      }
    },
    [listaId]
  );

  return { lista, items, loading, saving, refetch, agregar, quitar, guardarPrecios, activar };
}
