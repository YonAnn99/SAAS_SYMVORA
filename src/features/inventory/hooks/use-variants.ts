"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import type {
  ProductoOption,
  VarianteProducto,
} from "../types/inventory.types";
import {
  archiveVariant,
  createVariant,
  deleteVariant,
  fetchVariantProducts,
  fetchVariants,
  updateVariant,
  updateVariantCampos,
  type VarianteInput,
} from "../services/variant-service";
import { etiquetaAtributos } from "../atributos-variante";
import { esUltimaVarianteActiva, type ProductoDeLaVariante } from "../archivar-variante";
import { esErrorDeHistorial } from "../services/product-service";
import { useConfirmar } from "@/components/ui/confirmar";
import {
  fetchVariantesFavoritas,
  toggleVarianteFavorita,
} from "../services/favorites-service";
import { mensajeDeError } from "../error-message";
import { createAdjustment } from "../services/inventory-adjustment-service";
import { deltaStock, parsearCampo } from "../inline-edit";

/** Lo que se edita en la celda de una variante en el catalogo. */
export type CampoInlineVariante = "precio_venta" | "stock_actual";
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
import { guardarCache, leerCache } from "@/lib/cache-datos";

/** Cache entre modulos (`lib/cache-datos.ts`): variantes, sus favoritas y productos. */
interface VariantesEnCache {
  variantes: VarianteProducto[];
  favoritas: string[];
  productos: ProductoOption[];
}

/**
 * `onCambio`: se llama tras crear, editar o borrar. El catalogo lo usa para
 * refrescar los productos (el stock del padre puede cambiar con sus variantes).
 *
 * `cargarProductos: false`: no consulta la lista de productos (`products` queda
 * vacia). La pagina de Productos ya los tiene cargados y arma esa lista de
 * ellos; pedirlos aqui otra vez era una consulta duplicada en cada visita.
 */
export function useVariants(
  tenantId: string | null,
  tenantLoading: boolean,
  onCambio?: () => void,
  { cargarProductos = true }: { cargarProductos?: boolean } = {}
) {
  // Mismo criterio que la pestaña de productos: con un local elegido, cada
  // talla muestra lo que hay EN ESE local.
  const { seleccionada, hayVarias, activas, restringido, permitidas } = useSucursal();
  const claveCache = [
    "variantes",
    tenantId,
    seleccionada,
    restringido,
    permitidas,
    cargarProductos,
  ] as const;
  // Lo ultimo cargado en esta pestaña: se pinta ya y la carga normal lo
  // reemplaza en cuanto llega.
  const [enCache] = useState(() => leerCache<VariantesEnCache>(claveCache));
  const [variants, setVariants] = useState<VarianteProducto[]>(() => enCache?.variantes ?? []);
  const [products, setProducts] = useState<ProductoOption[]>(() => enCache?.productos ?? []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !enCache);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VarianteProducto | null>(
    null
  );
  // Ventana para CREAR variantes (`CrearVariantesDialog`): con producto base
  // agrega variantes a ese producto; sin el, crea el producto general nuevo.
  const [showCrear, setShowCrear] = useState(false);
  const [productoBase, setProductoBase] = useState<ProductoOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<VarianteProducto | null>(
    null
  );
  // Celdas de variante con un guardado en vuelo (edicion en la celda).
  const [guardandoVariantes, setGuardandoVariantes] = useState<Set<string>>(() => new Set());
  // Corazones por variante (migracion 098), del usuario actual.
  const [favoritas, setFavoritas] = useState<Set<string>>(() => new Set(enCache?.favoritas));

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    const sumarSuyas = !seleccionada && restringido;
    const [variantsData, productsData, stockLocal, favoritasData] = await Promise.all([
      fetchVariants(tenantId),
      cargarProductos ? fetchVariantProducts(tenantId) : Promise.resolve([] as ProductoOption[]),
      seleccionada
        ? fetchStockSucursal(seleccionada)
        : sumarSuyas
          ? fetchStockSucursal(permitidas)
          : Promise.resolve(null),
      fetchVariantesFavoritas(tenantId),
    ]);
    const variantes = !stockLocal
      ? variantsData
      : sumarSuyas
        ? conStockSumadoVariantes(variantsData, stockLocal)
        : conStockDeSucursalVariantes(variantsData, stockLocal);
    setFavoritas(favoritasData);
    setVariants(variantes);
    setProducts(productsData);
    setLoading(false);
    guardarCache<VariantesEnCache>(
      ["variantes", tenantId, seleccionada, restringido, permitidas, cargarProductos],
      { variantes, favoritas: [...favoritasData], productos: productsData }
    );
  }, [tenantId, seleccionada, restringido, permitidas, cargarProductos]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const openCreateDialog = useCallback(() => {
    setProductoBase(null);
    setShowCrear(true);
  }, []);

  const openCreateForProduct = useCallback((producto: ProductoOption) => {
    setProductoBase(producto);
    setShowCrear(true);
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
        onCambio?.();
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
    [tenantId, editingVariant, refetch, hayVarias, seleccionada, activas, onCambio]
  );

  /**
   * Varias variantes a la vez (una por combinacion de atributos). Mismas reglas
   * de stock por sucursal que `handleSave`; se detiene en la primera que falle
   * y dice cual, para no dejar a medias sin avisar. `onCreada(indice)` avisa
   * cada una que si quedo, para que el reintento no la repita.
   */
  const handleSaveMany = useCallback(
    async (inputs: VarianteInput[], onCreada?: (indice: number) => void) => {
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
        for (const [indice, input] of inputs.entries()) {
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
            onCreada?.(indice);
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
            onCambio?.();
            return false;
          }
        }
        toast.success(creadas === 1 ? "Variante creada" : `${creadas} variantes creadas`);
        void refetch();
        onCambio?.();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [tenantId, hayVarias, seleccionada, activas, refetch, onCambio]
  );

  const confirmar = useConfirmar();

  // Sube al archivar: la pestaña "Archivados" vuelve a consultar.
  const [archivadosVersion, setArchivadosVersion] = useState(0);

  /** Sale del catalogo y del POS; su historial no cambia (migracion 110). */
  const archivar = useCallback(
    async (variant: VarianteProducto): Promise<boolean> => {
      const nombre = etiquetaAtributos(variant) || "Variante";
      try {
        await archiveVariant(variant.id);
        await logActivity({
          action: "UPDATE",
          entity: "producto",
          entityId: variant.id,
          entityName: nombre,
          details: { archivado: true },
        });
        toast.success(`«${nombre}» se archivó`, {
          description: "La encuentras en la pestaña Archivados.",
        });
        setDeleteConfirm(null);
        setArchivadosVersion((n) => n + 1);
        void refetch();
        onCambio?.();
        return true;
      } catch (error) {
        toast.error(mensajeDeError(error));
        return false;
      }
    },
    [refetch, onCambio]
  );

  /**
   * Pide confirmacion y archiva. Si es la ultima variante activa de su
   * producto, archiva el producto completo (`archivar-variante.ts`).
   * `conHistorial`: se llego aqui porque no se pudo eliminar.
   */
  const confirmarYArchivar = useCallback(
    async (
      variant: VarianteProducto,
      producto: ProductoDeLaVariante | undefined,
      conHistorial: boolean
    ): Promise<boolean> => {
      const nombre = etiquetaAtributos(variant) || "Variante";
      const ultima = producto !== undefined && esUltimaVarianteActiva(variant, variants);
      const porHistorial = conHistorial
        ? "Tiene ventas, compras o movimientos registrados: para no alterar tus reportes no se puede eliminar. "
        : "";
      const ok = await confirmar(
        ultima
          ? {
              titulo: conHistorial ? `«${nombre}» tiene historial` : `¿Archivar «${producto.nombre}»?`,
              descripcion: `${porHistorial}Es la única variante de «${producto.nombre}», así que se archiva el producto completo: deja de aparecer en el catálogo y en el punto de venta, y lo puedes restaurar desde la pestaña Archivados.`,
              accion: "Archivar producto",
              tono: "aviso",
            }
          : {
              titulo: conHistorial ? `«${nombre}» tiene historial` : `¿Archivar «${nombre}»?`,
              descripcion: `${porHistorial}${conHistorial ? "Puedes archivarla: d" : "D"}eja de aparecer en el catálogo y en el punto de venta. Sus ventas y reportes se conservan, y la puedes restaurar desde la pestaña Archivados.`,
              accion: "Archivar",
              tono: "aviso",
            }
      );
      if (!ok) return false;
      return ultima ? producto.archivar() : archivar(variant);
    },
    [variants, confirmar, archivar]
  );

  const handleArchive = useCallback(
    (variant: VarianteProducto, producto?: ProductoDeLaVariante) =>
      confirmarYArchivar(variant, producto, false),
    [confirmarYArchivar]
  );

  const handleDelete = useCallback(
    async (variant: VarianteProducto, producto?: ProductoDeLaVariante) => {
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
        onCambio?.();
        return true;
      } catch (error) {
        if (!esErrorDeHistorial(error)) {
          toast.error("Error al eliminar la variante");
          // La fila deslizable del celular se colapsa ANTES de borrar: con
          // `false` sabe que tiene que reaparecer.
          return false;
        }
        // Con ventas o compras la base no deja borrarla: se ofrece archivarla.
        return confirmarYArchivar(variant, producto, true);
      }
    },
    [refetch, onCambio, confirmarYArchivar]
  );

  /**
   * Edicion en la celda del catalogo (precio o stock), como los productos
   * (`useProducts.handleInlineSave`): optimista, se revierte si falla, y el
   * stock pasa por el libro de ajustes del local que se esta viendo.
   */
  const handleInlineSaveVariante = useCallback(
    async (variant: VarianteProducto, campo: CampoInlineVariante, texto: string) => {
      const parseo = parsearCampo(campo, texto);
      if (!parseo.ok) {
        toast.error(parseo.error);
        return;
      }
      const valor = parseo.valor as number;
      if (Number(variant[campo]) === valor) return;

      const destino = destinoDeEdicionDeStock(hayVarias, seleccionada);
      if (campo === "stock_actual" && destino.tipo === "bloqueado") {
        toast.error(destino.motivo);
        return;
      }

      const anterior = variant[campo];
      setVariants((prev) => prev.map((v) => (v.id === variant.id ? { ...v, [campo]: valor } : v)));
      setGuardandoVariantes((prev) => new Set(prev).add(variant.id));
      try {
        if (campo === "stock_actual") {
          await createAdjustment({
            productoId: variant.producto_id,
            cantidadAjuste: deltaStock(Number(variant.stock_actual), valor),
            motivo: "CONTEO_FISICO",
            notas: "Edición rápida desde el catálogo",
            varianteId: variant.id,
            loteId: null,
            sucursalId: destino.tipo === "sucursal" ? destino.sucursalId : null,
          });
        } else {
          await updateVariantCampos(variant.id, { precio_venta: valor });
        }
        void refetch();
        onCambio?.();
      } catch (error: unknown) {
        setVariants((prev) => prev.map((v) => (v.id === variant.id ? { ...v, [campo]: anterior } : v)));
        toast.error(mensajeDeError(error));
      } finally {
        setGuardandoVariantes((prev) => {
          const sig = new Set(prev);
          sig.delete(variant.id);
          return sig;
        });
      }
    },
    [hayVarias, seleccionada, refetch, onCambio]
  );

  /** Optimista: si falla, el corazon regresa y se avisa. */
  const toggleFavorita = useCallback(
    async (variant: VarianteProducto) => {
      if (!tenantId) return;
      const era = favoritas.has(variant.id);
      setFavoritas((prev) => {
        const sig = new Set(prev);
        if (era) sig.delete(variant.id);
        else sig.add(variant.id);
        return sig;
      });
      try {
        await toggleVarianteFavorita(tenantId, variant.id, !era);
      } catch (error: unknown) {
        setFavoritas((prev) => {
          const rev = new Set(prev);
          if (era) rev.add(variant.id);
          else rev.delete(variant.id);
          return rev;
        });
        toast.error(mensajeDeError(error));
      }
    },
    [tenantId, favoritas]
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
    showCrear,
    setShowCrear,
    productoBase,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    refetch,
    openCreateDialog,
    openCreateForProduct,
    openEditDialog,
    handleSave,
    handleSaveMany,
    handleDelete,
    handleArchive,
    archivadosVersion,
    favoritas,
    toggleFavorita,
    handleInlineSaveVariante,
    guardandoVariantes,
  };
}