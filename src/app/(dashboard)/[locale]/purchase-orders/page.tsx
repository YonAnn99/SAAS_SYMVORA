"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Pencil, Trash2, Send, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { OrdenCompra, DetalleOrdenCompra, Proveedor, Producto } from "@/lib/types/database";

interface OrdenFormData {
  proveedor_id: string;
  numero_orden: string;
  notas: string;
  items: OrderItem[];
}

interface OrderItem {
  producto_id: string;
  cantidad_solicitada: string;
  costo_unitario: string;
}

const defaultFormData: OrdenFormData = {
  proveedor_id: "",
  numero_orden: "",
  notas: "",
  items: [{ producto_id: "", cantidad_solicitada: "", costo_unitario: "" }],
};

const estadoLabels: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  RECIBIDA_PARCIAL: "Recibida Parcial",
  RECIBIDA_TOTAL: "Recibida Total",
  CANCELADA: "Cancelada",
};

const estadoColors: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-800",
  ENVIADA: "bg-blue-100 text-blue-800",
  RECIBIDA_PARCIAL: "bg-yellow-100 text-yellow-800",
  RECIBIDA_TOTAL: "bg-green-100 text-green-800",
  CANCELADA: "bg-red-100 text-red-800",
};

export default function PurchaseOrdersPage() {
  const { tenantId, loading: tenantLoading } = useCurrentTenant();
  const [orders, setOrders] = useState<OrdenCompra[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; nombre: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; nombre: string; costo_compra: number }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenCompra | null>(null);
  const [formData, setFormData] = useState<OrdenFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OrdenCompra | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("ordenes_compra")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("creado_en", { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  }, [tenantId]);

  const fetchSuppliers = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (data) setSuppliers(data);
  }, [tenantId]);

  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    const supabase = createSupabaseBrowserClient();

    const { data } = await supabase
      .from("productos")
      .select("id, nombre, costo_compra")
      .eq("tenant_id", tenantId)
      .order("nombre");

    if (data) setProducts(data);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantLoading) {
      fetchOrders();
      fetchSuppliers();
      fetchProducts();
    }
  }, [tenantLoading, fetchOrders, fetchSuppliers, fetchProducts]);

  const filteredOrders = orders.filter(
    (order) =>
      order.numero_orden.toLowerCase().includes(search.toLowerCase()) ||
      getSupplierName(order.proveedor_id).toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingOrder(null);
    setFormData(defaultFormData);
    setShowDialog(true);
  };

  const openEditDialog = async (order: OrdenCompra) => {
    setEditingOrder(order);
    
    const supabase = createSupabaseBrowserClient();
    const { data: details } = await supabase
      .from("detalle_orden_compra")
      .select("*")
      .eq("orden_compra_id", order.id);

    const items: OrderItem[] = details?.map((d) => ({
      producto_id: d.producto_id,
      cantidad_solicitada: d.cantidad_solicitada.toString(),
      costo_unitario: d.costo_unitario.toString(),
    })) || [{ producto_id: "", cantidad_solicitada: "", costo_unitario: "" }];

    setFormData({
      proveedor_id: order.proveedor_id,
      numero_orden: order.numero_orden,
      notas: order.notas || "",
      items,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.proveedor_id) {
      toast.error("Selecciona un proveedor");
      return;
    }

    if (!formData.numero_orden) {
      toast.error("Ingresa el número de orden");
      return;
    }

    if (formData.items.length === 0 || !formData.items[0].producto_id) {
      toast.error("Agrega al menos un producto");
      return;
    }

    if (!tenantId) {
      toast.error("No se pudo identificar el tenant");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // Calculate totals
    let subtotal = 0;
    formData.items.forEach((item) => {
      subtotal += parseFloat(item.cantidad_solicitada || "0") * parseFloat(item.costo_unitario || "0");
    });
    const impuesto = subtotal * 0.16;
    const total = subtotal + impuesto;

    const orderData = {
      tenant_id: tenantId,
      proveedor_id: formData.proveedor_id,
      numero_orden: formData.numero_orden,
      subtotal,
      impuesto,
      total,
      notas: formData.notas || null,
    };

    if (editingOrder) {
      const { error } = await supabase
        .from("ordenes_compra")
        .update(orderData)
        .eq("id", editingOrder.id);

      if (error) {
        toast.error("Error al actualizar la orden");
      } else {
        // Delete existing details and re-insert
        await supabase
          .from("detalle_orden_compra")
          .delete()
          .eq("orden_compra_id", editingOrder.id);

        const details = formData.items
          .filter((item) => item.producto_id)
          .map((item) => ({
            orden_compra_id: editingOrder.id,
            producto_id: item.producto_id,
            cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            subtotal: parseFloat(item.cantidad_solicitada || "0") * parseFloat(item.costo_unitario || "0"),
          }));

        await supabase.from("detalle_orden_compra").insert(details);
        toast.success("Orden actualizada");
        fetchOrders();
      }
    } else {
      const { data: newOrder, error } = await supabase
        .from("ordenes_compra")
        .insert(orderData)
        .select()
        .single();

      if (error) {
        toast.error("Error al crear la orden");
      } else {
        const details = formData.items
          .filter((item) => item.producto_id)
          .map((item) => ({
            orden_compra_id: newOrder.id,
            producto_id: item.producto_id,
            cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            subtotal: parseFloat(item.cantidad_solicitada || "0") * parseFloat(item.costo_unitario || "0"),
          }));

        await supabase.from("detalle_orden_compra").insert(details);
        toast.success("Orden creada");
        fetchOrders();
      }
    }

    setSaving(false);
    setShowDialog(false);
  };

  const handleStatusChange = async (order: OrdenCompra, newStatus: string) => {
    const supabase = createSupabaseBrowserClient();
    
    const updates: Record<string, unknown> = { estado: newStatus };
    if (newStatus === "ENVIADA" || newStatus === "RECIBIDA_TOTAL") {
      updates.fecha_recepcion = new Date().toISOString();
    }

    const { error } = await supabase
      .from("ordenes_compra")
      .update(updates)
      .eq("id", order.id);

    if (error) {
      toast.error("Error al actualizar el estado");
    } else {
      toast.success(`Orden marcada como ${estadoLabels[newStatus]}`);
      fetchOrders();
    }
  };

  const handleDelete = async (order: OrdenCompra) => {
    const supabase = createSupabaseBrowserClient();
    
    // Delete details first
    await supabase
      .from("detalle_orden_compra")
      .delete()
      .eq("orden_compra_id", order.id);

    const { error } = await supabase
      .from("ordenes_compra")
      .delete()
      .eq("id", order.id);

    if (error) {
      toast.error("Error al eliminar la orden");
    } else {
      toast.success("Orden eliminada");
      fetchOrders();
    }
    setDeleteConfirm(null);
  };

  const updateField = (field: keyof OrdenFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { producto_id: "", cantidad_solicitada: "", costo_unitario: "" }],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.nombre || "Proveedor desconocido";
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up stagger-1">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Órdenes de Compra
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona órdenes de compra con flujo de estados
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 active:scale-[0.98] transition-transform"
          onClick={openCreateDialog}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nueva orden
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Orders table */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Órdenes de Compra</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {orders.length} órdenes
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {orders.length === 0
                  ? "No hay órdenes de compra"
                  : "No se encontraron órdenes"}
              </p>
              <Button
                size="sm"
                className="h-8 mt-1 active:scale-[0.98] transition-transform"
                onClick={openCreateDialog}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nueva orden
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">N° Orden</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Proveedor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Fecha</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Total
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium text-sm font-mono">
                      {order.numero_orden}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getSupplierName(order.proveedor_id)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.creado_en).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      ${order.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${estadoColors[order.estado]}`}
                      >
                        {estadoLabels[order.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.estado === "BORRADOR" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openEditDialog(order)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-600"
                              onClick={() => handleStatusChange(order, "ENVIADA")}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Enviar
                            </Button>
                          </>
                        )}
                        {order.estado === "ENVIADA" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-600"
                            onClick={() => handleStatusChange(order, "RECIBIDA_TOTAL")}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Recibir
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(order)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingOrder ? "Editar orden" : "Crear orden de compra"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingOrder
                ? "Actualiza los datos de la orden"
                : "Crea una nueva orden de compra"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Proveedor *</Label>
                <Select
                  value={formData.proveedor_id}
                  onValueChange={(v) => updateField("proveedor_id", v ?? "")}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número de orden *</Label>
                <Input
                  placeholder="OC-001"
                  value={formData.numero_orden}
                  onChange={(e) => updateField("numero_orden", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Productos</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={addItem}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar
                </Button>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 items-end">
                  <div className="space-y-1.5 col-span-2">
                    <Select
                      value={item.producto_id}
                      onValueChange={(v) => updateItem(index, "producto_id", v ?? "")}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Cantidad"
                      value={item.cantidad_solicitada}
                      onChange={(e) => updateItem(index, "cantidad_solicitada", e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Costo"
                      value={item.costo_unitario}
                      onChange={(e) => updateItem(index, "costo_unitario", e.target.value)}
                      className="h-8 text-sm font-mono"
                    />
                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={formData.notas}
                onChange={(e) => updateField("notas", e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 active:scale-[0.98] transition-transform"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : editingOrder ? "Guardar cambios" : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Eliminar orden</DialogTitle>
            <DialogDescription className="text-xs">
              ¿Estás seguro de eliminar esta orden? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
