"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
import { useMoneda } from "@/hooks/use-moneda";
import { notifyCashRegisterChanged } from "@/features/cash-register/hooks/use-open-register";
import type {
  Proveedor,
  PurchaseWithRelations,
} from "../types/inventory.types";
import { validarCompraDirecta, type RenglonCompraForm } from "../compra-directa";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  fetchPurchases,
  fetchSuppliers,
  type PurchaseInput,
  type SupplierInput,
  updatePurchase,
  updatePurchaseStatus,
  updateSupplier,
} from "../services/purchase-service";
import { esErrorDeHistorial } from "../services/product-service";
import { mensajeDeError } from "@/features/inventory/error-message";
// El selector de productos de la compra directa es el MISMO que el de las
// ordenes, asi que se reusan sus consultas en vez de duplicarlas.
import {
  fetchOrderProducts,
  fetchOrderVariants,
  type VarianteDeCompra,
} from "../services/purchase-order-service";
import type { ProductoOpcion } from "../purchase-order-items";
import { guardarCache, leerCache } from "@/lib/cache-datos";

/** Cache entre modulos (`lib/cache-datos.ts`). */
interface ComprasEnCache {
  compras: PurchaseWithRelations[];
  proveedores: Proveedor[];
  productos: ProductoOpcion[];
  variantes: VarianteDeCompra[];
}

const claveCompras = (tenantId: string) => ["compras", tenantId] as const;

export function usePurchases(tenantId: string, tenantLoading: boolean) {
  const { formatear } = useMoneda();
  const t = useTranslations("purchases.msg");
  const tEstado = useTranslations("purchases");
  const te = useTranslations("inventory.errors");
  // Lo ultimo cargado en esta pestaña: se pinta ya y `refetch` lo reemplaza.
  const [enCache] = useState(() => leerCache<ComprasEnCache>(claveCompras(tenantId)));
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>(() => enCache?.compras ?? []);
  const [suppliers, setSuppliers] = useState<Proveedor[]>(() => enCache?.proveedores ?? []);
  const [products, setProducts] = useState<ProductoOpcion[]>(() => enCache?.productos ?? []);
  const [variants, setVariants] = useState<VarianteDeCompra[]>(() => enCache?.variantes ?? []);
  const [loading, setLoading] = useState(() => !enCache);
  const [showNewPurchaseDialog, setShowNewPurchaseDialog] = useState(false);
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<PurchaseWithRelations | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Proveedor | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    // Con datos en cache no se muestra el "cargando": se actualiza por detras.
    if (!leerCache(claveCompras(tenantId))) setLoading(true);
    // Pase lo que pase, el "Cargando" se apaga: sin esto, un error lo dejaba fijo y solo se salia con F5.
    try {
      const [purchasesData, suppliersData, productsData, variantsData] =
        await Promise.all([
          fetchPurchases(tenantId),
          fetchSuppliers(tenantId),
          fetchOrderProducts(tenantId),
          fetchOrderVariants(tenantId),
        ]);
      setPurchases(purchasesData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setVariants(variantsData);
      guardarCache<ComprasEnCache>(claveCompras(tenantId), {
        compras: purchasesData,
        proveedores: suppliersData,
        productos: productsData,
        variantes: variantsData,
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantLoading) return;
    const timeout = window.setTimeout(() => void refetch(), 0);
    return () => window.clearTimeout(timeout);
  }, [tenantLoading, refetch]);

  const handleCreatePurchase = useCallback(
    async (input: PurchaseInput, renglones: RenglonCompraForm[]) => {
      if (!input.proveedorId || !tenantId) {
        toast.error(t("missingData"));
        return;
      }

      // El servidor valida lo mismo y es quien manda; esto es para decirlo
      // antes del viaje y señalando el renglón concreto.
      const validacion = validarCompraDirecta(renglones);
      if (!validacion.ok && validacion.motivo) {
        const motivo = t(`rows.${validacion.motivo}`);
        toast.error(validacion.renglon ? t("rowAt", { motivo, renglon: validacion.renglon }) : motivo);
        return;
      }

      try {
        await createPurchase(tenantId, input);
        await logActivity({
          action: "CREATE",
          entity: "compra",
          entityName: `Compra ${input.numeroFactura || ""}`,
          details: {
            proveedor_id: input.proveedorId,
            renglones: input.items.length,
            iva: input.incluyeIva,
            pagada_con_caja: Boolean(input.cajaId),
          },
        });
        if (input.cajaId) {
          // La salida ya quedo registrada por el RPC: que Finanzas y el
          // encabezado lo vean sin recargar.
          notifyCashRegisterChanged();
          toast.success(t("createdFromCash"));
        } else {
          toast.success(t("created"));
        }
        setShowNewPurchaseDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("createErrorDetail", { error: error.message })
            : t("createError")
        );
      }
    },
    [tenantId, refetch, t]
  );

  const openEditPurchase = useCallback((purchase: PurchaseWithRelations) => {
    setEditingPurchase(purchase);
    setShowNewPurchaseDialog(true);
  }, []);

  const handleUpdatePurchase = useCallback(
    async (purchaseId: string, input: PurchaseInput) => {
      if (!input.proveedorId) {
        toast.error(t("missingData"));
        return;
      }

      try {
        await updatePurchase(purchaseId, input);
        await logActivity({
          action: "UPDATE",
          entity: "compra",
          entityId: purchaseId,
          entityName: `Compra ${input.numeroFactura || ""}`,
          details: { proveedor_id: input.proveedorId },
        });
        toast.success(t("updated"));
        setShowNewPurchaseDialog(false);
        setEditingPurchase(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("updateErrorDetail", { error: error.message })
            : t("updateError")
        );
      }
    },
    [refetch, t]
  );

  const handleCreateSupplier = useCallback(
    async (input: SupplierInput) => {
      if (!tenantId) {
        toast.error(t("noTenant"));
        return;
      }

      try {
        await createSupplier(tenantId, input);
        await logActivity({
          action: "CREATE",
          entity: "proveedor",
          entityName: input.nombre,
          details: { email: input.email, telefono: input.phone },
        });
        toast.success(t("supplierCreated"));
        setShowNewSupplierDialog(false);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("supplierCreateErrorDetail", { error: error.message })
            : t("supplierCreateError")
        );
      }
    },
    [tenantId, refetch, t]
  );

  const openEditSupplier = useCallback((supplier: Proveedor) => {
    setEditingSupplier(supplier);
    setShowNewSupplierDialog(true);
  }, []);

  const handleUpdateSupplier = useCallback(
    async (supplierId: string, input: SupplierInput) => {
      try {
        await updateSupplier(supplierId, input);
        await logActivity({
          action: "UPDATE",
          entity: "proveedor",
          entityId: supplierId,
          entityName: input.nombre,
          details: { email: input.email, telefono: input.phone },
        });
        toast.success(t("supplierUpdated"));
        setShowNewSupplierDialog(false);
        setEditingSupplier(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("supplierUpdateErrorDetail", { error: error.message })
            : t("supplierUpdateError")
        );
      }
    },
    [refetch, t]
  );

  /** `false` si no se pudo: la fila deslizable del celular reaparece. */
  const handleDeleteSupplier = useCallback(
    async (supplier: Proveedor): Promise<boolean> => {
      try {
        await deleteSupplier(supplier.id);
        await logActivity({
          action: "DELETE",
          entity: "proveedor",
          entityId: supplier.id,
          entityName: supplier.nombre,
        });
        toast.success(t("supplierDeleted"));
        void refetch();
        return true;
      } catch (error) {
        toast.error(
          esErrorDeHistorial(error)
            ? t("supplierHasHistory", { nombre: supplier.nombre })
            : mensajeDeError(error, te)
        );
        return false;
      }
    },
    [refetch, t, te]
  );

  const handleUpdatePurchaseStatus = useCallback(
    async (
      purchaseId: string,
      estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA"
    ) => {
      try {
        await updatePurchaseStatus(purchaseId, estado);
        await logActivity({
          action: "UPDATE",
          entity: "compra",
          entityId: purchaseId,
          details: { nuevo_estado: estado },
        });
        toast.success(t("markedAs", { estado: tEstado(`statuses.${estado}`).toLowerCase() }));
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("statusErrorDetail", { error: error.message })
            : t("statusError")
        );
      }
    },
    [refetch, t, tEstado]
  );

  const handleDeletePurchase = useCallback(
    async (purchaseId: string) => {
      try {
        await deletePurchase(purchaseId);
        await logActivity({
          action: "DELETE",
          entity: "compra",
          entityId: purchaseId,
        });
        toast.success(t("deleted"));
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? t("deleteErrorDetail", { error: error.message })
            : t("deleteError")
        );
      }
    },
    [refetch, t]
  );

  const handleCancelPurchase = useCallback(
    async (purchaseId: string) => {
      try {
        const resultado = await cancelPurchase(purchaseId);
        await logActivity({
          action: "UPDATE",
          entity: "compra",
          entityId: purchaseId,
          details: {
            estado: "CANCELADA",
            stock: "revertido",
            devuelto_a_caja: resultado.devuelto_a_caja,
          },
        });
        if (resultado.devuelto_a_caja > 0) {
          notifyCashRegisterChanged();
          toast.success(
            t("canceledRefund", { monto: formatear(resultado.devuelto_a_caja) })
          );
        } else {
          toast.success(t("canceled"));
        }
        // Se pago con una caja cuyo corte ya se cerro: no se toca (reabrirlo
        // lo descuadraria), pero hay que decirlo para que se ajuste a mano.
        if (resultado.caja_cerrada) {
          toast.warning(
            t("closedRegister"),
            { duration: 10000 }
          );
        }
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("cancelError")
        );
      }
    },
    [refetch, t, formatear]
  );

  const handlePurchaseDialogOpenChange = useCallback((open: boolean) => {
    setShowNewPurchaseDialog(open);
    if (!open) setEditingPurchase(null);
  }, []);

  const handleSupplierDialogOpenChange = useCallback((open: boolean) => {
    setShowNewSupplierDialog(open);
    if (!open) setEditingSupplier(null);
  }, []);

  return {
    purchases,
    suppliers,
    products,
    variants,
    loading,
    showNewPurchaseDialog,
    setShowNewPurchaseDialog: handlePurchaseDialogOpenChange,
    editingPurchase,
    openEditPurchase,
    showNewSupplierDialog,
    setShowNewSupplierDialog: handleSupplierDialogOpenChange,
    editingSupplier,
    openEditSupplier,
    handleCreatePurchase,
    handleUpdatePurchase,
    handleCreateSupplier,
    handleUpdateSupplier,
    handleDeleteSupplier,
    handleUpdatePurchaseStatus,
    handleDeletePurchase,
    handleCancelPurchase,
    refetch,
  };
}