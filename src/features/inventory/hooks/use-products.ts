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
  sinMinimoDefinido,
  type ProductFilters,
} from "@/features/inventory/stock-status";
import {
  deltaStock,
  hayCambio,
  parsearCampo,
  type CampoInline,
} from "@/features/inventory/inline-edit";
import { createAdjustment } from "../services/inventory-adjustment-service";
import { fetchFavoritos, toggleFavorito } from "../services/favorites-service";
import { mensajeDeError } from "@/features/inventory/error-message";

export function useProducts(tenantId: string | null, tenantLoading: boolean) {
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Producto | null>(null);

  // Ids marcados con el corazon por el usuario ACTUAL. Viven aparte de
  // `products` porque son de otra tabla y de otro dueño: dos usuarios ven el
  // mismo catalogo con distintos favoritos.
  const [favoritos, setFavoritos] = useState<Set<string>>(() => new Set());

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    // En paralelo: son dos tablas distintas y esperar una para pedir la otra
    // solo suma latencia a la primera carga.
    const [data, favs] = await Promise.all([
      fetchProducts(tenantId),
      fetchFavoritos(tenantId),
    ]);
    setProducts(data);
    setFavoritos(favs);
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

  // Ids con una edicion express en vuelo. Es un Set y no un booleano porque
  // se puede estar guardando el precio de una fila mientras se edita el stock
  // de otra; un solo flag bloquearia la tabla entera.
  const [guardandoInline, setGuardandoInline] = useState<Set<string>>(
    () => new Set()
  );

  const marcarGuardando = useCallback((id: string, activo: boolean) => {
    setGuardandoInline((prev) => {
      const siguiente = new Set(prev);
      if (activo) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }, []);

  /**
   * Guardado de una sola celda de la tabla.
   *
   * NO llama a `logActivity`: `productos` tiene el trigger `trg_log_productos`
   * (migracion 032) que ya escribe la bitacora en cada UPDATE. El camino del
   * dialogo llama a los dos y por eso la bitacora tiene las entidades
   * "producto" y "productos" duplicadas; esto no agrava el problema.
   */
  const handleInlineSave = useCallback(
    async (product: Producto, campo: CampoInline, texto: string) => {
      const parseo = parsearCampo(campo, texto);
      if (!parseo.ok) {
        toast.error(parseo.error);
        return;
      }
      if (!hayCambio(product, campo, parseo.valor)) return;

      const anterior = product[campo];
      // Optimista: el numero cambia al instante y, con el, el margen y el
      // badge de estado, que se derivan de el.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, [campo]: parseo.valor } : p
        )
      );
      marcarGuardando(product.id, true);

      try {
        if (campo === "stock_actual") {
          // El stock NO se escribe a pelo: pasa por el libro de ajustes, que
          // deja constancia de quien, cuando y cuanto. El RPC espera la
          // DIFERENCIA, no el total.
          await createAdjustment({
            productoId: product.id,
            cantidadAjuste: deltaStock(
              product.stock_actual,
              parseo.valor as number
            ),
            motivo: "CONTEO_FISICO",
            notas: "Edición rápida desde el catálogo",
            varianteId: null,
            loteId: null,
          });
          // El servidor manda sobre el stock: entre el clic y el guardado
          // pudo entrar una venta del punto de venta.
          void refetch();
        } else {
          await updateProduct(product.id, { [campo]: parseo.valor });
        }
      } catch (error: unknown) {
        // Se revierte: dejar en pantalla un valor que la base rechazo es peor
        // que no haber editado, porque el cajero se va creyendo que se guardo.
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, [campo]: anterior } : p
          )
        );
        toast.error(mensajeDeError(error));
      } finally {
        marcarGuardando(product.id, false);
      }
    },
    [marcarGuardando, refetch]
  );

  /**
   * Marca o desmarca el corazon.
   *
   * Optimista sin excepcion: es un clic que solo cambia un icono, y esperar a
   * la red para pintarlo haria que el corazon "tardara" en cada pulsacion.
   */
  const handleToggleFavorito = useCallback(
    async (product: Producto) => {
      if (!tenantId) return;

      const eraFavorito = favoritos.has(product.id);
      const siguiente = new Set(favoritos);
      if (eraFavorito) siguiente.delete(product.id);
      else siguiente.add(product.id);
      setFavoritos(siguiente);

      try {
        await toggleFavorito(tenantId, product.id, !eraFavorito);
      } catch (error: unknown) {
        // Se vuelve al estado anterior. Sin esto el corazon quedaria relleno
        // pero el producto no saldria en el filtro tras recargar, que es la
        // clase de incoherencia que hace desconfiar de la pantalla entera.
        setFavoritos((prev) => {
          const revertido = new Set(prev);
          if (eraFavorito) revertido.add(product.id);
          else revertido.delete(product.id);
          return revertido;
        });
        toast.error(mensajeDeError(error));
      }
    },
    [tenantId, favoritos]
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
    () => applyProductFilters(searchedProducts, filters, favoritos),
    [searchedProducts, filters, favoritos]
  );

  // Los conteos de los chips salen del catálogo COMPLETO, no de lo ya
  // filtrado: si salieran de lo filtrado, marcar "stock bajo" pondría los
  // otros dos chips en cero y no se podría volver atrás con criterio.
  const stockCounts = useMemo(() => countByStatus(products), [products]);

  // Mismo criterio que `stockCounts`: sobre el catalogo completo.
  const sinMinimoCount = useMemo(
    () => products.filter(sinMinimoDefinido).length,
    [products]
  );

  // Se cuentan los favoritos QUE SIGUEN EN EL CATALOGO, no el tamaño del Set.
  // Con la busqueda activa el Set no cambia, pero un favorito borrado por otra
  // pestaña dejaria el numero inflado respecto a lo que se puede enseñar.
  const favoritosCount = useMemo(
    () => products.filter((p) => favoritos.has(p.id)).length,
    [products, favoritos]
  );

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
    handleInlineSave,
    guardandoInline,
    favoritos,
    favoritosCount,
    sinMinimoCount,
    handleToggleFavorito,
    handleDelete,
  };
}