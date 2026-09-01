"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { productSchema } from "@/lib/validations/schemas";
import { toast } from "sonner";
import type { Producto } from "../../types/inventory.types";
import {
  defaultProductFormData,
  type ProductFormData,
} from "../../types/inventory.types";
import type { ProductInput } from "../../services/product-service";
import { generateNextBarcode, generateNextSku } from "../../services/product-service";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Producto | null;
  saving: boolean;
  onSave: (input: ProductInput) => void;
  tenantId: string;
}

export function ProductDialog({
  open,
  onOpenChange,
  editingProduct,
  saving,
  onSave,
  tenantId,
}: ProductDialogProps) {
  const t = useTranslations();
  const [formData, setFormData] = useState<ProductFormData>(
    defaultProductFormData
  );
  const [generating, setGenerating] = useState(false);

  const syncFromEditing = (product: Producto | null) => {
    if (product) {
      setFormData({
        nombre: product.nombre,
        descripcion: product.descripcion || "",
        codigo_barras: product.codigo_barras || "",
        sku: product.sku || "",
        unidad_medida: product.unidad_medida,
        precio_venta: product.precio_venta.toString(),
        costo_compra: product.costo_compra.toString(),
        stock_actual: product.stock_actual.toString(),
        stock_minimo: product.stock_minimo.toString(),
        es_servicio: product.es_servicio,
        categoria: product.categoria || "",
      });
    } else {
      setFormData(defaultProductFormData);
    }
  };

  const generateCodes = async () => {
    if (editingProduct) return;
    setGenerating(true);
    try {
      const [barcode, sku] = await Promise.all([
        generateNextBarcode(tenantId),
        generateNextSku(tenantId),
      ]);
      setFormData((prev) => ({ ...prev, codigo_barras: barcode, sku }));
    } catch (error) {
      console.error("Error generating codes:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setFormData(defaultProductFormData);
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      syncFromEditing(editingProduct);
      if (!editingProduct) {
        generateCodes();
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingProduct, tenantId]);

  const updateField = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const parsed = productSchema.safeParse({
      ...formData,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    onSave({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      codigo_barras: formData.codigo_barras || null,
      sku: formData.sku || null,
      unidad_medida: formData.unidad_medida,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      costo_compra: parseFloat(formData.costo_compra) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      stock_minimo: parseFloat(formData.stock_minimo) || 0,
      es_servicio: formData.es_servicio,
      categoria: formData.categoria || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingProduct ? "Editar producto" : "Crear producto"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingProduct
              ? "Actualiza los datos del producto"
              : "Agrega un nuevo producto a tu catálogo"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              placeholder="Nombre del producto"
              value={formData.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Textarea
              placeholder="Descripción del producto"
              value={formData.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Código de barras {(!editingProduct && formData.codigo_barras) && <span className="text-emerald-500 ml-1 text-[10px]">(auto)</span>}</Label>
              <Input
                placeholder="EAN-13"
                value={formData.codigo_barras}
                onChange={(e) => updateField("codigo_barras", e.target.value)}
                className="h-8 text-sm font-mono"
                readOnly={!editingProduct && !!formData.codigo_barras}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SKU {(!editingProduct && formData.sku) && <span className="text-emerald-500 ml-1 text-[10px]">(auto)</span>}</Label>
              <Input
                placeholder="SKU-001"
                value={formData.sku}
                onChange={(e) => updateField("sku", e.target.value)}
                className="h-8 text-sm font-mono"
                readOnly={!editingProduct && !!formData.sku}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidad de medida *</Label>
              <Select
                value={formData.unidad_medida}
                onValueChange={(v) => v && updateField("unidad_medida", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIEZA">Pieza</SelectItem>
                  <SelectItem value="KG">Kilogramo</SelectItem>
                  <SelectItem value="GRAMO">Gramo</SelectItem>
                  <SelectItem value="LITRO">Litro</SelectItem>
                  <SelectItem value="SERVICIO">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Input
                placeholder="Ej: Bebidas"
                value={formData.categoria}
                onChange={(e) => updateField("categoria", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label className="text-xs">Costo de compra *</Label>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Stock mínimo</Label>
              <Input
                type="number"
                min="0"
                placeholder="5"
                value={formData.stock_minimo}
                onChange={(e) => updateField("stock_minimo", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.es_servicio}
              onCheckedChange={(v) => updateField("es_servicio", v)}
            />
            <Label className="text-xs">Es servicio (no maneja stock)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? t("common.loading")
              : editingProduct
                ? "Guardar cambios"
                : "Crear producto"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}