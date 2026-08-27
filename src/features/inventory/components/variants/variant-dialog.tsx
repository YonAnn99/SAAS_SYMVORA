"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import type {
  ProductoOption,
  VarianteProducto,
} from "../../types/inventory.types";
import {
  defaultVarianteFormData,
  type VarianteFormData,
} from "../../types/inventory.types";
import type { VarianteInput } from "../../services/variant-service";

interface VariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingVariant: VarianteProducto | null;
  products: ProductoOption[];
  saving: boolean;
  onSave: (input: VarianteInput) => void;
}

export function VariantDialog({
  open,
  onOpenChange,
  editingVariant,
  products,
  saving,
  onSave,
}: VariantDialogProps) {
  const [formData, setFormData] = useState<VarianteFormData>(
    defaultVarianteFormData
  );

  const syncFromEditing = (variant: VarianteProducto | null) => {
    if (variant) {
      setFormData({
        producto_id: variant.producto_id,
        sku: variant.sku || "",
        codigo_barras: variant.codigo_barras || "",
        talla: variant.talla || "",
        color: variant.color || "",
        precio_venta: variant.precio_venta.toString(),
        costo_compra: variant.costo_compra.toString(),
        stock_actual: variant.stock_actual.toString(),
      });
    } else {
      setFormData(defaultVarianteFormData);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setFormData(defaultVarianteFormData);
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(
      () => syncFromEditing(editingVariant),
      0
    );
    return () => window.clearTimeout(timeout);
  }, [open, editingVariant]);

  const selectedProductName = useMemo(
    () => products.find((p) => p.id === formData.producto_id)?.nombre ?? formData.producto_id,
    [products, formData.producto_id]
  );

  const updateField = (field: keyof VarianteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.precio_venta || parseFloat(formData.precio_venta) <= 0) {
      toast.error("El precio de venta debe ser mayor a 0");
      return;
    }

    onSave({
      producto_id: formData.producto_id,
      sku: formData.sku || null,
      codigo_barras: formData.codigo_barras || null,
      talla: formData.talla || null,
      color: formData.color || null,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingVariant ? "Editar variante" : "Crear variante"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingVariant
              ? "Actualiza los datos de la variante"
              : "Agrega una nueva variante a tu catálogo"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Producto *</Label>
            <Select
              value={formData.producto_id}
              onValueChange={(v) => updateField("producto_id", v ?? "")}
              disabled={Boolean(editingVariant)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccionar producto">
                  {selectedProductName}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Talla</Label>
              <Input
                placeholder="Ej: S, M, L, XL"
                value={formData.talla}
                onChange={(e) => updateField("talla", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <Input
                placeholder="Ej: Rojo, Azul"
                value={formData.color}
                onChange={(e) => updateField("color", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input
                placeholder="SKU-001-S"
                value={formData.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código de barras</Label>
              <Input
                placeholder="EAN-13"
                value={formData.codigo_barras}
                onChange={(e) => updateField("codigo_barras", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Precio de venta *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.precio_venta}
                onChange={(e) => updateField("precio_venta", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Costo de compra</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.costo_compra}
                onChange={(e) => updateField("costo_compra", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock actual</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={formData.stock_actual}
                onChange={(e) => updateField("stock_actual", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Guardando..."
              : editingVariant
                ? "Guardar cambios"
                : "Crear variante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}