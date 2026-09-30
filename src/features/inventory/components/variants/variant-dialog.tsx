"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { DeslizarParaConfirmar } from "@/components/ui/deslizar-para-confirmar";
import { COLOR_ALTA, SONIDO_ALTA, celebrarAlta, precargarSonido } from "@/lib/celebracion";
import { BotonEscanear } from "@/components/escaner/boton-escanear";
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
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxTrigger,
} from "@/components/ui/combobox";
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
  /** `true` si quedo guardada. Cerrar lo decide el dialogo. */
  onSave: (input: VarianteInput) => Promise<boolean>;
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

  const productoElegido = useMemo(
    () => products.find((p) => p.id === formData.producto_id) ?? null,
    [products, formData.producto_id]
  );

  const sinProductos = products.length === 0;

  const updateField = (field: keyof VarianteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** Valida y guarda. `true` si quedo guardada. */
  const handleSave = async (): Promise<boolean> => {
    if (!formData.producto_id) {
      toast.error("Selecciona un producto");
      return false;
    }

    if (!formData.precio_venta || parseFloat(formData.precio_venta) <= 0) {
      toast.error("El precio de venta debe ser mayor a 0");
      return false;
    }

    return onSave({
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

  // Al crear se confirma deslizando, con sonido: se deja descargado al abrir.
  useEffect(() => {
    if (open && !editingVariant) precargarSonido(SONIDO_ALTA);
  }, [open, editingVariant]);

  // Editar: boton de siempre, y se cierra al guardar.
  const guardarEdicion = async () => {
    if (await handleSave()) handleOpenChange(false);
  };

  // Crear: si algo no pasa se rechaza, para que la pastilla muestre el error
  // y regrese (el aviso ya salio).
  const crearDeslizando = async () => {
    if (!(await handleSave())) throw new Error("No se guardó");
  };

  // Tras la pastilla azul: sonido y destello, y se cierra como en el POS.
  const trasCrear = (origen: DOMRect | null) => {
    celebrarAlta(origen);
    window.setTimeout(() => handleOpenChange(false), 900);
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
            {/* Con buscador, como Lotes y Nueva compra: con cientos de
                productos una lista sin filtro no sirve. */}
            {sinProductos ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                Primero agrega productos en la pestaña Catálogo.
              </p>
            ) : (
              <Combobox
                items={products}
                value={formData.producto_id || null}
                onValueChange={(v) => updateField("producto_id", (v as string) ?? "")}
                itemToStringLabel={(v) =>
                  products.find((p) => p.id === v)?.nombre ?? ""
                }
                filter={(candidato, query) =>
                  (candidato as unknown as ProductoOption).nombre
                    .toLowerCase()
                    .includes(query.toLowerCase())
                }
                disabled={Boolean(editingVariant)}
              >
                <ComboboxInputGroup className="h-8 w-full">
                  <ComboboxInput placeholder="Buscar producto..." />
                  <ComboboxTrigger />
                </ComboboxInputGroup>
                <ComboboxPortal>
                  <ComboboxPositioner>
                    <ComboboxPopup>
                      <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                      <ComboboxList>
                        {(p: ProductoOption) => (
                          <ComboboxItem key={p.id} value={p.id}>
                            <ComboboxItemIndicator />
                            <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                            {p.permite_variantes && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                                Con variantes
                              </span>
                            )}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxPopup>
                  </ComboboxPositioner>
                </ComboboxPortal>
              </Combobox>
            )}
            {!editingVariant && productoElegido && !productoElegido.permite_variantes && (
              <p className="text-[11px] text-muted-foreground">
                Al guardar se activará &quot;Maneja variantes&quot; en este producto.
              </p>
            )}
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
              <div className="relative">
                <Input
                  placeholder="EAN-13"
                  value={formData.codigo_barras}
                  onChange={(e) => updateField("codigo_barras", e.target.value)}
                  className="h-8 pr-9 text-sm font-mono"
                />
                <BotonEscanear
                  modo="uno"
                  titulo="Escanear código de la variante"
                  onCodigo={(codigo) => updateField("codigo_barras", codigo)}
                />
              </div>
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
        {editingVariant ? (
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
              onClick={() => void guardarEdicion()}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </SpecularActionButton>
          </DialogFooter>
        ) : (
          // Mismo "desliza para confirmar" que cobrar en el POS, en azul.
          <div className="flex flex-col items-stretch gap-2">
            <DeslizarParaConfirmar
              label="Desliza para crear variante"
              doneLabel="Variante creada"
              errorLabel="No se guardó"
              successColor={COLOR_ALTA}
              disabled={sinProductos}
              onConfirm={crearDeslizando}
              onDone={trasCrear}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-center text-muted-foreground"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}