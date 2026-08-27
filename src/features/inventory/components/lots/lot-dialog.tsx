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
  Lote,
  ProductoOption,
} from "../../types/inventory.types";
import {
  defaultLoteFormData,
  type LoteFormData,
} from "../../types/inventory.types";
import type { LoteInput } from "../../services/lot-service";

interface LotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLot: Lote | null;
  products: ProductoOption[];
  saving: boolean;
  onSave: (input: LoteInput) => void;
}

export function LotDialog({
  open,
  onOpenChange,
  editingLot,
  products,
  saving,
  onSave,
}: LotDialogProps) {
  const [formData, setFormData] = useState<LoteFormData>(defaultLoteFormData);

  const syncFromEditing = (lot: Lote | null) => {
    if (lot) {
      setFormData({
        producto_id: lot.producto_id,
        numero_lote: lot.numero_lote,
        cantidad: lot.cantidad.toString(),
        fecha_caducidad: lot.fecha_caducidad || "",
        fecha_fabricacion: lot.fecha_fabricacion || "",
        costo_unitario: lot.costo_unitario.toString(),
      });
    } else {
      setFormData(defaultLoteFormData);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setFormData(defaultLoteFormData);
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => syncFromEditing(editingLot), 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingLot]);

  const selectedProductName = useMemo(
    () => products.find((p) => p.id === formData.producto_id)?.nombre ?? formData.producto_id,
    [products, formData.producto_id]
  );

  const updateField = (field: keyof LoteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.numero_lote) {
      toast.error("Ingresa el número de lote");
      return;
    }

    if (!formData.cantidad || parseFloat(formData.cantidad) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    onSave({
      producto_id: formData.producto_id,
      numero_lote: formData.numero_lote,
      cantidad: parseFloat(formData.cantidad) || 0,
      fecha_caducidad: formData.fecha_caducidad || null,
      fecha_fabricacion: formData.fecha_fabricacion || null,
      costo_unitario: parseFloat(formData.costo_unitario) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingLot ? "Editar lote" : "Crear lote"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingLot
              ? "Actualiza los datos del lote"
              : "Agrega un nuevo lote de producto"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Producto *</Label>
            <Select
              value={formData.producto_id}
              onValueChange={(v) => updateField("producto_id", v ?? "")}
              disabled={Boolean(editingLot)}
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
              <Label className="text-xs">Número de lote *</Label>
              <Input
                placeholder="LOTE-001"
                value={formData.numero_lote}
                onChange={(e) => updateField("numero_lote", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad *</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={formData.cantidad}
                onChange={(e) => updateField("cantidad", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de fabricación</Label>
              <Input
                type="date"
                value={formData.fecha_fabricacion}
                onChange={(e) =>
                  updateField("fecha_fabricacion", e.target.value)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de caducidad</Label>
              <Input
                type="date"
                value={formData.fecha_caducidad}
                onChange={(e) => updateField("fecha_caducidad", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Costo unitario</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.costo_unitario}
              onChange={(e) => updateField("costo_unitario", e.target.value)}
              className="h-8 text-sm font-mono"
            />
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
              : editingLot
                ? "Guardar cambios"
                : "Crear lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}