"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/supabase/activity-logger";
import type { OrdenCompra, DetalleOrdenCompra } from "../types/inventory.types";
import { normalizarTelefonoMx, urlWhatsApp } from "@/lib/whatsapp";
import { mensajeParaProveedor } from "../purchase-order-message";
import {
  createOrder,
  deleteOrder,
  fetchOrderDetails,
  fetchOrderProducts,
  fetchOrders,
  fetchOrderSuppliers,
  orderEstadoLabels,
  updateOrder,
  updateOrderStatus,
  receiveOrder,
  fetchOrderVariants,
  type VarianteDeCompra,
  type OrderDetailItem,
  type ItemRecepcion,
  type ProveedorContacto,
} from "../services/purchase-order-service";
import {
  ordenLlevaIva,
  totalesOrdenCompra,
} from "../purchase-order-totals";

export interface OrdenSaveInput {
  proveedor_id: string;
  numero_orden: string;
  notas: string;
  /** Si la orden lleva el 16 %. Se guarda como `impuesto = 0` cuando es `false`. */
  incluye_iva: boolean;
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
  const [orders, setOrders] = useState<OrdenCompra[]>([]);
  const [suppliers, setSuppliers] = useState<ProveedorContacto[]>([]);
  const [products, setProducts] = useState<{
    id: string;
    nombre: string;
    costo_compra: number;
  }[]>([]);
  const [variants, setVariants] = useState<VarianteDeCompra[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenCompra | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrdenCompra | null>(null);

  const refetch = useCallback(async () => {
    if (!tenantId) return;
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
    setLoading(false);
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
        if (!user) throw new Error("No se pudo identificar el usuario");

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
          toast.success("Orden actualizada");
        } else {
          await createOrder(tenantId, user.id, orderData, details);
          await logActivity({
            action: "CREATE",
            entity: "orden_compra",
            entityName: input.numero_orden,
            details: { proveedor_id: input.proveedor_id, total, items: details.length },
          });
          toast.success("Orden creada");
        }
        setShowDialog(false);
        void refetch();
      } catch {
        toast.error("Error al guardar la orden");
      } finally {
        setSaving(false);
      }
    },
    [tenantId, editingOrder, refetch]
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
        toast.success(`Orden marcada como ${orderEstadoLabels[newStatus]}`);
        void refetch();
      } catch {
        toast.error("Error al actualizar el estado");
      }
    },
    [refetch]
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
    async (items: ItemRecepcion[], numeroFactura: string | null) => {
      if (!receivingOrder) return;
      setReceiving(true);
      try {
        const resultado = await receiveOrder(
          receivingOrder.id,
          items,
          numeroFactura
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
          },
        });
        toast.success(
          resultado.nuevo_estado === "RECIBIDA_TOTAL"
            ? "Orden recibida completa. Se registró la compra y subió el stock."
            : "Recepción parcial registrada. La orden sigue abierta."
        );
        setReceivingOrder(null);
        void refetch();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : "No se pudo registrar la recepción"
        );
      } finally {
        setReceiving(false);
      }
    },
    [receivingOrder, refetch]
  );

  // ---- Envío al proveedor por WhatsApp ----

  /**
   * Abre WhatsApp con el pedido ya escrito.
   *
   * NO cambia el estado de la orden, y es deliberado: abrir el chat no es
   * prueba de haberlo enviado, y pasar a ENVIADA bloquea la edición. Si se
   * abandona el chat, la orden quedaría bloqueada sin que el proveedor haya
   * recibido nada. Marcarla como enviada sigue siendo el botón "Enviar".
   */
  const handleWhatsApp = useCallback(
    async (order: OrdenCompra) => {
      const proveedor = suppliers.find((s) => s.id === order.proveedor_id);
      const telefono = normalizarTelefonoMx(proveedor?.telefono);
      if (!telefono) {
        toast.error("Este proveedor no tiene un teléfono válido");
        return;
      }

      const details = await fetchOrderDetails(order.id);
      const mensaje = mensajeParaProveedor({
        numeroOrden: order.numero_orden,
        proveedor: proveedor?.nombre ?? "",
        negocio: nombreNegocio,
        lineas: details.map((d) => ({
          nombre:
            products.find((p) => p.id === d.producto_id)?.nombre ?? "Producto",
          cantidad: Number(d.cantidad_solicitada),
          costo_unitario: Number(d.costo_unitario),
        })),
        total: Number(order.total),
        // Se deduce de la orden guardada, no de un parametro: asi el mensaje
        // no puede contradecir a lo que se guardo.
        incluyeIva: ordenLlevaIva(order),
        fechaEstimada: order.fecha_estimada_recepcion,
      });

      window.open(urlWhatsApp(telefono, mensaje), "_blank", "noopener");
    },
    [suppliers, products, nombreNegocio]
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
        toast.success("Orden eliminada");
        setDeleteConfirm(null);
        void refetch();
      } catch {
        toast.error("Error al eliminar la orden");
      }
    },
    [refetch]
  );

  const getSupplierName = useCallback(
    (supplierId: string) =>
      suppliers.find((s) => s.id === supplierId)?.nombre ||
      "Proveedor desconocido",
    [suppliers]
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
  };
}

export { fetchOrderDetails };