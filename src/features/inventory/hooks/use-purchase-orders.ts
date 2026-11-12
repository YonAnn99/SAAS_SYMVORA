"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/supabase/activity-logger";
import { useMoneda } from "@/hooks/use-moneda";
import { notifyCashRegisterChanged } from "@/features/cash-register/hooks/use-open-register";
import type { OrdenCompra, DetalleOrdenCompra } from "../types/inventory.types";
import { normalizarTelefonoMx, urlWhatsApp } from "@/lib/whatsapp";
import { mensajeParaProveedor } from "../purchase-order-message";
import {
  datosPdfDeOrden,
  generarPdfOrdenCompra,
  nombreConVariante,
} from "../purchase-order-pdf";
import type { ProductoOpcion } from "../purchase-order-items";
import {
  createOrder,
  deleteOrder,
  fetchOrderDetails,
  fetchOrderProducts,
  fetchOrders,
  fetchOrderSuppliers,
  updateOrder,
  updateOrderStatus,
  receiveOrder,
  fetchOrderVariants,
  subirPdfOrden,
  type VarianteDeCompra,
  type OrderDetailItem,
  type ItemRecepcion,
  type ProveedorContacto,
} from "../services/purchase-order-service";
import { totalesOrdenCompra } from "../purchase-order-totals";
import { guardarCache, leerCache } from "@/lib/cache-datos";

export interface OrdenSaveInput {
  proveedor_id: string;
  numero_orden: string;
  notas: string;
  /** Si la orden lleva el 16 %. Se guarda como `impuesto = 0` cuando es `false`. */
  incluye_iva: boolean;
  /** Local que recibira la mercancia. `null` en un negocio de un solo local. */
  sucursal_id: string | null;
  items: {
    producto_id: string;
    variante_id: string | null;
    cantidad_solicitada: string;
    costo_unitario: string;
  }[];
}

export function usePurchaseOrders(
  tenantId: string | null,
  tenantLoading: boolean,
  /** Para firmar el mensaje de WhatsApp con el nombre de la tienda. */
  nombreNegocio: string = "nuestro negocio"
) {
  const { formatear, moneda } = useMoneda();
  const t = useTranslations("purchaseOrders.msg");
  const tEstado = useTranslations("purchaseOrders.statuses");
  // Cache entre modulos (`lib/cache-datos.ts`): se pinta lo ultimo cargado y
  // `refetch` lo reemplaza en cuanto llega.
  const [enCache] = useState(() =>
    leerCache<{
      ordenes: OrdenCompra[];
      proveedores: ProveedorContacto[];
      productos: ProductoOpcion[];
      variantes: VarianteDeCompra[];
    }>(["ordenes-compra", tenantId])
  );
  const [orders, setOrders] = useState<OrdenCompra[]>(() => enCache?.ordenes ?? []);
  const [suppliers, setSuppliers] = useState<ProveedorContacto[]>(() => enCache?.proveedores ?? []);
  const [products, setProducts] = useState<ProductoOpcion[]>(() => enCache?.productos ?? []);
  const [variants, setVariants] = useState<VarianteDeCompra[]>(() => enCache?.variantes ?? []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !enCache);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenCompra | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrdenCompra | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
    // Pase lo que pase, el "Cargando" se apaga: sin esto, un error lo dejaba fijo y solo se salia con F5.
    try {
      const [ordersData, suppliersData, productsData, variantsData] =
        await Promise.all([
          fetchOrders(tenantId),
          fetchOrderSuppliers(tenantId),
          fetchOrderProducts(tenantId),
          fetchOrderVariants(tenantId),
        ]);
      setOrders(ordersData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setVariants(variantsData);
      guardarCache(["ordenes-compra", tenantId], {
        ordenes: ordersData,
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

  const openCreateDialog = useCallback(() => {
    setEditingOrder(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback(async (order: OrdenCompra) => {
    setEditingOrder(order);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(
    async (input: OrdenSaveInput) => {
      if (!tenantId) return;
      setSaving(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error(t("noUser"));

        // La MISMA funcion que usa el dialogo para pintar los totales. Antes
        // aqui habia un `subtotal * 0.16` suelto: dos cuentas separadas que
        // coincidian solo mientras el IVA fuera siempre obligatorio.
        const { subtotal, impuesto, total } = totalesOrdenCompra(
          input.items,
          input.incluye_iva
        );

        const details: OrderDetailItem[] = input.items
          .filter((item) => item.producto_id)
          .map((item) => ({
            producto_id: item.producto_id,
            variante_id: item.variante_id,
            cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            subtotal:
              parseFloat(item.cantidad_solicitada || "0") *
              parseFloat(item.costo_unitario || "0"),
          }));

        const orderData = {
          proveedor_id: input.proveedor_id,
          numero_orden: input.numero_orden,
          subtotal,
          impuesto,
          total,
          notas: input.notas || null,
          sucursal_id: input.sucursal_id,
        };

        if (editingOrder) {
          await updateOrder(editingOrder.id, orderData, details);
          await logActivity({
            action: "UPDATE",
            entity: "orden_compra",
            entityId: editingOrder.id,
            entityName: input.numero_orden,
            details: { total, items: details.length },
          });
          toast.success(t("updated"));
        } else {
          await createOrder(tenantId, user.id, orderData, details);
          await logActivity({
            action: "CREATE",
            entity: "orden_compra",
            entityName: input.numero_orden,
            details: { proveedor_id: input.proveedor_id, total, items: details.length },
          });
          toast.success(t("created"));
        }
        setShowDialog(false);
        void refetch();
      } catch {
        toast.error(t("saveError"));
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingOrder, refetch, t]
  );

  const handleStatusChange = useCallback(
    async (order: OrdenCompra, newStatus: OrdenCompra["estado"]) => {
      try {
        await updateOrderStatus(order.id, newStatus);
        await logActivity({
          action: "UPDATE",
          entity: "orden_compra",
          entityId: order.id,
          entityName: order.numero_orden,
          details: { nuevo_estado: newStatus },
        });
        toast.success(t("markedAs", { estado: tEstado(newStatus) }));
        void refetch();
      } catch {
        toast.error(t("statusError"));
      }
    },
    [refetch, t, tEstado]
  );

  // ---- Recepción de mercancía ----

  const [receivingOrder, setReceivingOrder] = useState<OrdenCompra | null>(null);
  const [receivingDetails, setReceivingDetails] = useState<DetalleOrdenCompra[]>([]);
  const [receiving, setReceiving] = useState(false);

  /**
   * Abre el diálogo de recepción.
   *
   * Los renglones se cargan aquí y no en `refetch` porque solo hacen falta al
   * recibir: traerlos para toda la tabla serían N consultas por pintar la lista.
   */
  const openReceiveDialog = useCallback(async (order: OrdenCompra) => {
    const details = await fetchOrderDetails(order.id);
    setReceivingDetails(details);
    setReceivingOrder(order);
  }, []);

  const handleReceive = useCallback(
    async (
      items: ItemRecepcion[],
      numeroFactura: string | null,
      cajaId: string | null = null
    ) => {
      if (!receivingOrder) return;
      setReceiving(true);
      try {
        const resultado = await receiveOrder(
          receivingOrder.id,
          items,
          numeroFactura,
          cajaId
        );
        await logActivity({
          action: "UPDATE",
          entity: "orden_compra",
          entityId: receivingOrder.id,
          entityName: receivingOrder.numero_orden,
          details: {
            recibido: true,
            nuevo_estado: resultado.nuevo_estado,
            compra_id: resultado.compra_id,
            pagada_con_caja: Boolean(cajaId),
          },
        });
        const pagoCaja = cajaId
          ? ` ${t("paidFromCash", { monto: formatear(resultado.total) })}`
          : "";
        if (cajaId) notifyCashRegisterChanged();
        toast.success(
          (resultado.nuevo_estado === "RECIBIDA_TOTAL"
            ? t("receivedFull")
            : t("receivedPartial")) + pagoCaja
        );
        setReceivingOrder(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : t("receiveError")
        );
      } finally {
        setReceiving(false);
      }
    },
    [receivingOrder, refetch, t, formatear]
  );

  // ---- Envío al proveedor por WhatsApp ----

  /** La orden que se esta preparando para WhatsApp (PDF subiendose). */
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  /**
   * Envia la orden al proveedor por WhatsApp: genera el PDF, lo sube, marca la
   * orden como ENVIADA y abre el chat con un resumen y el enlace al PDF.
   *
   * Antes eran dos botones ("Enviar" solo cambiaba el estado y "WhatsApp"
   * solo abria el chat) y el usuario pidio unificarlos: pulsar WhatsApp ES
   * enviar la orden. "Enviar" queda solo para proveedores sin telefono valido.
   *
   * El PDF va por enlace porque WhatsApp no deja adjuntar archivos desde un
   * enlace wa.me (solo texto). Si algo falla antes de abrir el chat, la orden
   * NO cambia de estado: no se bloquea una orden que nadie recibio.
   *
   * En una orden ya ENVIADA sirve para reenviarla (PDF nuevo, sin tocar el
   * estado).
   */
  const handleWhatsApp = useCallback(
    async (order: OrdenCompra) => {
      const proveedor = suppliers.find((s) => s.id === order.proveedor_id);
      const telefono = normalizarTelefonoMx(proveedor?.telefono);
      if (!telefono || !tenantId) {
        toast.error(t("noPhone"));
        return;
      }

      // La pestaña se abre YA, dentro del clic: abierta despues de los
      // `await` el navegador la bloquea como ventana emergente. Se abre sin
      // "noopener" porque con el `window.open` devuelve null y no se podria
      // redirigir; el `opener` se corta a mano abajo.
      const pestana = window.open("", "_blank");
      setEnviandoId(order.id);

      try {
        const details = await fetchOrderDetails(order.id);
        const nombreRenglon = (d: DetalleOrdenCompra) =>
          nombreConVariante(
            products.find((p) => p.id === d.producto_id)?.nombre ?? "Producto",
            d.variante_id ? variants.find((v) => v.id === d.variante_id) : null
          );
        const datosPdf = datosPdfDeOrden({
          negocio: nombreNegocio,
          moneda,
          proveedor: proveedor?.nombre ?? "",
          orden: order,
          renglones: details.map((d) => ({ ...d, nombre: nombreRenglon(d) })),
        });
        const incluyeIva = datosPdf.incluyeIva;
        const pdf = await generarPdfOrdenCompra(datosPdf);

        const enlacePdf = await subirPdfOrden(tenantId, order.id, pdf);

        if (order.estado === "BORRADOR") {
          await updateOrderStatus(order.id, "ENVIADA");
          await logActivity({
            action: "UPDATE",
            entity: "orden_compra",
            entityId: order.id,
            entityName: order.numero_orden,
            details: { nuevo_estado: "ENVIADA", via: "whatsapp" },
          });
        }

        const url = urlWhatsApp(
          telefono,
          mensajeParaProveedor({
            moneda,
            numeroOrden: order.numero_orden,
            proveedor: proveedor?.nombre ?? "",
            negocio: nombreNegocio,
            total: Number(order.total),
            incluyeIva,
            fechaEstimada: order.fecha_estimada_recepcion,
            enlacePdf,
          })
        );

        if (pestana) {
          pestana.opener = null;
          pestana.location.href = url;
        } else {
          // Bloqueador de ventanas muy estricto: se abre en esta misma.
          window.location.href = url;
        }

        toast.success(
          order.estado === "BORRADOR"
            ? t("sentWhatsApp", { numero: order.numero_orden })
            : t("resentWhatsApp", { numero: order.numero_orden })
        );
        void refetch();
      } catch {
        pestana?.close();
        toast.error(t("whatsAppError"));
      } finally {
        setEnviandoId(null);
      }
    },
    [suppliers, products, variants, nombreNegocio, tenantId, refetch, t, moneda]
  );

  const handleDelete = useCallback(
    async (order: OrdenCompra) => {
      try {
        await deleteOrder(order.id);
        await logActivity({
          action: "DELETE",
          entity: "orden_compra",
          entityId: order.id,
          entityName: order.numero_orden,
        });
        toast.success(t("deleted"));
        setDeleteConfirm(null);
        void refetch();
        return true;
      } catch {
        toast.error(t("deleteError"));
        // La fila deslizable del celular se colapsa ANTES de borrar: con
        // `false` sabe que tiene que reaparecer.
        return false;
      }
    },
    [refetch, t]
  );

  const getSupplierName = useCallback(
    (supplierId: string) =>
      suppliers.find((s) => s.id === supplierId)?.nombre ||
      t("unknownSupplier"),
    [suppliers, t]
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.numero_orden.toLowerCase().includes(search.toLowerCase()) ||
          getSupplierName(order.proveedor_id)
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [orders, search, getSupplierName]
  );

  return {
    orders,
    suppliers,
    products,
    variants,
    filteredOrders,
    getSupplierName,
    search,
    setSearch,
    loading,
    showDialog,
    setShowDialog,
    editingOrder,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    refetch,
    openCreateDialog,
    openEditDialog,
    handleSave,
    handleStatusChange,
    handleDelete,
    receivingOrder,
    receivingDetails,
    receiving,
    openReceiveDialog,
    closeReceiveDialog: () => setReceivingOrder(null),
    handleReceive,
    handleWhatsApp,
    enviandoId,
  };
}

export { fetchOrderDetails };