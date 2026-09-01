"use client";

import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import type {
  LoteOption,
  ProductOption,
  VarianteOption,
} from "../../types/inventory.types";
import {
  defaultAjusteFormData,
  type AjusteFormData,
  type MotivoAjuste,
} from "../../types/inventory.types";
import type { AjusteInput } from "../../services/inventory-adjustment-service";

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  variants: VarianteOption[];
  lots: LoteOption[];
  saving: boolean;
  onProductChange: (productoId: string) => void;
  onSave: (input: AjusteInput) => void;
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  products,
  variants,
  lots,
  saving,
  onProductChange,
  onSave,
}: AdjustmentDialogProps) {
  const [formData, setFormData] = useState<AjusteFormData>(
    defaultAjusteFormData
  );

  const selectedProductName = useMemo(
    () => products.find((p) => p.id === formData.producto_id)?.nombre ?? formData.producto_id,
    [products, formData.producto_id]
  );

  const selectedVariantName = useMemo(() => {
    if (!formData.variante_id) return "";
    const variant = variants.find((v) => v.id === formData.variante_id);
    return variant ? `${variant.talla} - ${variant.color} (${variant.sku || "N/A"})` : formData.variante_id;
  }, [variants, formData.variante_id]);

  const selectedLotName = useMemo(() => {
    if (!formData.lote_id) return "";
    const lot = lots.find((l) => l.id === formData.lote_id);
    if (!lot) return formData.lote_id;
    let display = `${lot.numero_lote} - ${lot.cantidad} unidades`;
    if (lot.fecha_caducidad) {
      display += ` (Exp: ${new Date(lot.fecha_caducidad).toLocaleDateString("es-MX")})`;
    }
    return display;
  }, [lots, formData.lote_id]);

  const updateField = (field: keyof AjusteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductChange = (productoId: string) => {
    setFormData((prev) => ({
      ...prev,
      producto_id: productoId,
      variante_id: "",
      lote_id: "",
    }));
    onProductChange(productoId);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFormData(defaultAjusteFormData);
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }

    if (!formData.cantidad_ajuste || parseFloat(formData.cantidad_ajuste) === 0) {
      toast.error("La cantidad de ajuste no puede ser 0");
      return;
    }

    onSave({
      productoId: formData.producto_id,
      cantidadAjuste: parseFloat(formData.cantidad_ajuste),
      motivo: formData.motivo as MotivoAjuste,
      notas: formData.notas || null,
      varianteId: formData.variante_id || null,
      loteId: formData.lote_id || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Nuevo ajuste de inventario
          </DialogTitle>
          <DialogDescription className="text-xs">
            Registra un ajuste de stock con el motivo correspondiente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Producto *</Label>
            <Select
              value={formData.producto_id}
              onValueChange={(v) => handleProductChange(v ?? "")}
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

          {variants.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Variante (opcional)</Label>
              <Select
                value={formData.variante_id}
                onValueChange={(v) => updateField("variante_id", v ?? "")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sin variante">
                    {selectedVariantName || "Sin variante"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin variante</SelectItem>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.talla} - {variant.color} ({variant.sku || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {lots.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Lote (opcional)</Label>
              <Select
                value={formData.lote_id}
                onValueChange={(v) => updateField("lote_id", v ?? "")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Sin lote">
                    {selectedLotName || "Sin lote"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin lote</SelectItem>
                  {lots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.numero_lote} - {lot.cantidad} unidades
                      {lot.fecha_caducidad &&
                        ` (Exp: ${new Date(lot.fecha_caducidad).toLocaleDateString(
                          "es-MX"
                        )})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo *</Label>
            <Select
              value={formData.motivo}
              onValueChange={(v) => updateField("motivo", v ?? "")}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MERMA">Merma</SelectItem>
                <SelectItem value="CONTEO_FISICO">Conteo Físico</SelectItem>
                <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                <SelectItem value="DAÑO">Daño</SelectItem>
                <SelectItem value="OTRO">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Cantidad de ajuste *
              <span className="text-muted-foreground ml-2">
                (positivo para agregar, negativo para reducir)
              </span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Ej: 10 o -5"
              value={formData.cantidad_ajuste}
              onChange={(e) => updateField("cantidad_ajuste", e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              placeholder="Descripción del ajuste..."
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
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Registrar ajuste"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}