"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DetalleOrdenCompra, OrdenCompra } from "../../types/inventory.types";
import {
  defaultOrdenFormData,
  type OrdenFormData,
  type ProductOption,
} from "../../types/inventory.types";
import type { OrdenSaveInput } from "../../hooks/use-purchase-orders";
import type { OrderDetailItem } from "../../services/purchase-order-service";

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: OrdenCompra | null;
  initialDetails: DetalleOrdenCompra[];
  suppliers: ProductOption[];
  products: { id: string; nombre: string; costo_compra: number }[];
  existingOrders?: OrdenCompra[];
  saving: boolean;
  onSave: (input: OrdenSaveInput) => void;
}

const TAX_RATE = 0.16;

function getNextOrderNumber(existingOrders: OrdenCompra[]): string {
  const prefix = "OC-";
  const numbers = existingOrders
    .map((o) => o.numero_orden)
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function PurchaseOrderDialog({
  open,
  onOpenChange,
  editingOrder,
  initialDetails,
  suppliers,
  products,
  existingOrders = [],
  saving,
  onSave,
}: PurchaseOrderDialogProps) {
  const [formData, setFormData] = useState<OrdenFormData>(
    defaultOrdenFormData
  );

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      if (editingOrder) {
        setFormData({
          proveedor_id: editingOrder.proveedor_id,
          numero_orden: editingOrder.numero_orden,
          notas: editingOrder.notas || "",
          items: initialDetails.map((d) => ({
            producto_id: d.producto_id,
            cantidad_solicitada: d.cantidad_solicitada.toString(),
            costo_unitario: d.costo_unitario.toString(),
          })),
        });
      } else {
        setFormData({
          ...defaultOrdenFormData,
          numero_orden: getNextOrderNumber(existingOrders),
        });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingOrder, initialDetails, existingOrders]);

  const updateField = (field: keyof OrdenFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (
    index: number,
    field: keyof (typeof formData.items)[number],
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { producto_id: "", cantidad_solicitada: "", costo_unitario: "" },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const selectedProveedorName = useMemo(
    () => suppliers.find((s) => s.id === formData.proveedor_id)?.nombre ?? formData.proveedor_id,
    [suppliers, formData.proveedor_id]
  );

  const getProductCost = (productId: string): number => {
    const product = products.find((p) => p.id === productId);
    return product?.costo_compra ?? 0;
  };

  const handleProductChange = (index: number, productId: string) => {
    updateItem(index, "producto_id", productId);
    updateItem(index, "costo_unitario", getProductCost(productId).toString());
  };

  const subtotal = formData.items.reduce((acc, item) => {
    const cantidad = parseFloat(item.cantidad_solicitada) || 0;
    const costo = parseFloat(item.costo_unitario) || 0;
    return acc + cantidad * costo;
  }, 0);
  const impuesto = subtotal * TAX_RATE;
  const total = subtotal + impuesto;

  const handleSave = () => {
    if (!formData.proveedor_id) {
      toast.error("Selecciona un proveedor");
      return;
    }

    if (!formData.numero_orden) {
      toast.error("Ingresa el número de orden");
      return;
    }

    const details: OrderDetailItem[] = formData.items
      .filter((item) => item.producto_id)
      .map((item) => ({
        producto_id: item.producto_id,
        cantidad_solicitada: parseFloat(item.cantidad_solicitada) || 0,
        costo_unitario: parseFloat(item.costo_unitario) || 0,
        subtotal:
          (parseFloat(item.cantidad_solicitada) || 0) *
          (parseFloat(item.costo_unitario) || 0),
      }));

    if (details.length === 0) {
      toast.error("Agrega al menos un producto a la orden");
      return;
    }

    onSave({
      proveedor_id: formData.proveedor_id,
      numero_orden: formData.numero_orden,
      notas: formData.notas || "",
      items: details.map((d) => ({
        producto_id: d.producto_id,
        cantidad_solicitada: d.cantidad_solicitada.toString(),
        costo_unitario: d.costo_unitario.toString(),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingOrder ? "Editar orden de compra" : "Nueva orden de compra"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingOrder
              ? "Actualiza los datos de la orden"
              : "Crea una nueva orden de compra a proveedor"}
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
                  <SelectValue placeholder="Seleccionar proveedor">
                    {selectedProveedorName}
                  </SelectValue>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Productos</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agregar producto
              </Button>
            </div>
            {formData.items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg">
                Agrega productos a la orden
              </p>
            ) : (
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 items-end"
                  >
                    <div className="col-span-6 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Producto
                      </Label>
                      <Select
                        value={item.producto_id}
                        onValueChange={(v) =>
                          handleProductChange(index, v ?? "")
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Seleccionar">
                            {products.find((p) => p.id === item.producto_id)?.nombre ?? item.producto_id}
                          </SelectValue>
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
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Cantidad
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.cantidad_solicitada}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "cantidad_solicitada",
                            e.target.value
                          )
                        }
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Costo
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costo_unitario}
                        onChange={(e) =>
                          updateItem(index, "costo_unitario", e.target.value)
                        }
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

          <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm font-mono">
            <span className="text-muted-foreground text-xs">
              Subtotal: ${subtotal.toFixed(2)}
            </span>
            <span className="text-muted-foreground text-xs">
              IVA (16%): ${impuesto.toFixed(2)}
            </span>
            <span className="font-semibold">
              Total: ${total.toFixed(2)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Guardando..."
              : editingOrder
                ? "Guardar cambios"
                : "Crear orden"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}