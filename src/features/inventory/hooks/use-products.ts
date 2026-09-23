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
import { useSucursal } from "@/contexts/sucursal-context";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import {
  conStockDeSucursal,
  conStockSumado,
  destinoDeEdicionDeStock,
} from "@/features/sucursales/stock";
import {
  establecerStockSucursal,
  fetchStockSucursal,
} from "@/features/sucursales/services/stock-sucursal-service";

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

  // Con una sucursal elegida, la columna de existencias es la DE ESE LOCAL, no
  // el total del negocio. Todo lo que ya se deriva de `stock_actual` (stock
  // bajo, agotado, orden, filtros) pasa a hablar del local sin tocarlo.
  const { seleccionada, hayVarias, activas, restringido, permitidas } = useSucursal();

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    // En paralelo: son tablas distintas y esperar una para pedir la otra solo
    // suma latencia a la primera carga.
    // "Todas" de un usuario restringido son SUS locales: se suman esos, no el
    // total del negocio, que incluiria sucursales que no lleva.
    const sumarSuyas = !seleccionada && restringido;
    const [data, favs, stockLocal] = await Promise.all([
      fetchProducts(tenantId),
      fetchFavoritos(tenantId),
      seleccionada
        ? fetchStockSucursal(seleccionada)
        : sumarSuyas
          ? fetchStockSucursal(permitidas)
          : Promise.resolve(null),
    ]);
    setProducts(
      !stockLocal ? data : sumarSuyas ? conStockSumado(data, stockLocal) : conStockDeSucursal(data, stockLocal)
    );
    setFavoritos(favs);
    setLoading(false);
  }, [tenantId, seleccionada, restringido, permitidas]);

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

      // CON VARIAS SUCURSALES, el campo de existencias habla de UN local y no
      // se manda en el producto: `productos.stock_actual` es la suma que
      // mantiene la base, y escribirla a pelo mandaria las unidades al local
      // por defecto. Se guarda aparte, con `establecerStockSucursal`.
      const stock = Number(input.stock_actual ?? 0);
      let destinoStock: string | null = null;
      if (hayVarias) {
        if (editingProduct) {
          const destino = destinoDeEdicionDeStock(hayVarias, seleccionada);
          const cambio = stock !== Number(editingProduct.stock_actual);
          if (cambio && destino.tipo === "bloqueado") {
            toast.error(destino.motivo);
            return;
          }
          if (cambio && destino.tipo === "sucursal") destinoStock = destino.sucursalId;
        } else if (stock > 0) {
          destinoStock = destinoPorDefecto(seleccionada, activas);
          if (!destinoStock) {
            toast.error(
              "Elige en el selector de arriba a qué sucursal entran las existencias iniciales, o déjalas en 0 y repártelas después."
            );
            return;
          }
        }
      }
      const datosProducto: ProductInput = hayVarias
        ? {
            ...input,
            // Alta: nace en 0 y se carga en el local elegido. Edicion: se
            // conserva lo que hay; el cambio, si lo hubo, va por el local.
            stock_actual: editingProduct ? editingProduct.stock_actual : 0,
          }
        : input;

      setSaving(true);
      try {
        if (editingProduct) {
          // En modo sucursales se quita del UPDATE: aunque sea el mismo numero,
          // reescribirlo dispararia la capa de compatibilidad (080) con el
          // total del local elegido y lo convertiria en el total del negocio.
          const { stock_actual: _omitido, ...sinStock } = datosProducto;
          void _omitido;
          await updateProduct(editingProduct.id, hayVarias ? sinStock : datosProducto);
          if (destinoStock) {
            await establecerStockSucursal({
              sucursalId: destinoStock,
              productoId: editingProduct.id,
              cantidad: stock,
            });
          }
          await logActivity({
            action: "UPDATE",
            entity: "producto",
            entityId: editingProduct.id,
            entityName: input.nombre,
          });
          toast.success("Producto actualizado");
        } else {
          const nuevoId = await createProduct(tenantId, datosProducto);
          if (destinoStock) {
            await establecerStockSucursal({
              sucursalId: destinoStock,
              productoId: nuevoId,
              cantidad: stock,
            });
          }
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
        toast.error(mensajeDeError(error));
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingProduct, refetch, hayVarias, seleccionada, activas]
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

      // Antes del cambio optimista: con "Todas" y varias sucursales no hay
      // local sobre el que aplicar la diferencia (ver `destinoDeEdicionDeStock`).
      const destino = destinoDeEdicionDeStock(hayVarias, seleccionada);
      if (campo === "stock_actual" && destino.tipo === "bloqueado") {
        toast.error(destino.motivo);
        return;
      }

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
            // La diferencia se calculo contra lo que se ve, que con un local
            // elegido es lo de ESE local: el ajuste tiene que ir ahi.
            sucursalId: destino.tipo === "sucursal" ? destino.sucursalId : null,
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
    [marcarGuardando, refetch, hayVarias, seleccionada]
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