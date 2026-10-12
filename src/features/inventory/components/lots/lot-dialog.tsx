"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
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
import { SelectSimple } from "@/components/ui/select-simple";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSucursal } from "@/contexts/sucursal-context";
import { CampoSucursal } from "@/features/sucursales/components/campo-sucursal";
import { destinoPorDefecto } from "@/features/sucursales/seleccion";
import type { ProductoOption } from "../../types/inventory.types";
import type {
  LoteConExistencias,
  LoteEdicion,
  LoteInput,
  VarianteLoteOption,
} from "../../services/lot-service";

interface LotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLot: LoteConExistencias | null;
  products: ProductoOption[];
  variants: VarianteLoteOption[];
  saving: boolean;
  onCreate: (input: LoteInput) => void;
  onUpdate: (input: LoteEdicion) => void;
}

interface Formulario {
  producto_id: string;
  variante_id: string;
  sucursal_id: string | null;
  numero_lote: string;
  cantidad: string;
  fecha_caducidad: string;
  fecha_fabricacion: string;
  costo_unitario: string;
  suma_stock: boolean;
}

const VACIO: Formulario = {
  producto_id: "",
  variante_id: "",
  sucursal_id: null,
  numero_lote: "",
  cantidad: "",
  fecha_caducidad: "",
  fecha_fabricacion: "",
  costo_unitario: "",
  suma_stock: false,
};

export function LotDialog({
  open,
  onOpenChange,
  editingLot,
  products,
  variants,
  saving,
  onCreate,
  onUpdate,
}: LotDialogProps) {
  const { seleccionada, activas } = useSucursal();
  const [form, setForm] = useState<Formulario>(VACIO);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      setForm(
        editingLot
          ? {
              ...VACIO,
              producto_id: editingLot.producto_id,
              variante_id: editingLot.variante_id ?? "",
              numero_lote: editingLot.numero_lote,
              fecha_caducidad: editingLot.fecha_caducidad || "",
              fecha_fabricacion: editingLot.fecha_fabricacion || "",
              costo_unitario: String(editingLot.costo_unitario ?? ""),
            }
          : { ...VACIO, sucursal_id: destinoPorDefecto(seleccionada, activas) }
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingLot, seleccionada, activas]);

  const productoElegido = useMemo(
    () => products.find((p) => p.id === form.producto_id) ?? null,
    [products, form.producto_id]
  );
  const variantesDelProducto = useMemo(
    () => variants.filter((v) => v.producto_id === form.producto_id),
    [variants, form.producto_id]
  );
  const sinProductos = products.length === 0;

  const set = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSave = () => {
    if (!form.numero_lote.trim()) {
      toast.error("Ingresa el número de lote");
      return;
    }
    const costo = parseFloat(form.costo_unitario) || 0;

    if (editingLot) {
      onUpdate({
        numero_lote: form.numero_lote,
        fecha_caducidad: form.fecha_caducidad || null,
        fecha_fabricacion: form.fecha_fabricacion || null,
        costo_unitario: costo,
      });
      return;
    }

    if (!form.producto_id) {
      toast.error("Selecciona un producto");
      return;
    }
    if (variantesDelProducto.length > 0 && !form.variante_id) {
      toast.error("Elige la variante del lote");
      return;
    }
    if (activas.length > 1 && !form.sucursal_id) {
      toast.error("Elige la sucursal donde está el lote");
      return;
    }
    const cantidad = parseFloat(form.cantidad);
    if (!cantidad || cantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    onCreate({
      producto_id: form.producto_id,
      variante_id: form.variante_id || null,
      sucursal_id: form.sucursal_id,
      numero_lote: form.numero_lote,
      cantidad,
      fecha_caducidad: form.fecha_caducidad || null,
      fecha_fabricacion: form.fecha_fabricacion || null,
      costo_unitario: costo,
      suma_stock: form.suma_stock,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editingLot ? "Editar lote" : "Registrar lote"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editingLot
              ? "La cantidad cambia sola con compras, ventas, traspasos y ajustes."
              : "Cada lote se guarda en una sucursal; al vender sale primero el que caduca antes."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Producto *</Label>
            {/* Con buscador: con cientos de productos una lista sin filtro no
                sirve. Mismo patron que el selector de Nueva compra. */}
            {sinProductos ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                Primero agrega productos en la pestaña Catálogo.
              </p>
            ) : (
              <Combobox
                items={products}
                value={form.producto_id || null}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, producto_id: (v as string) ?? "", variante_id: "" }))
                }
                itemToStringLabel={(v) => products.find((p) => p.id === v)?.nombre ?? ""}
                filter={(candidato, query) =>
                  (candidato as unknown as ProductoOption).nombre
                    .toLowerCase()
                    .includes(query.toLowerCase())
                }
                disabled={Boolean(editingLot)}
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
                            {p.permite_lotes && (
                              <span className="shrink-0 text-[10px] text-muted-foreground/70">
                                Con lotes
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
            {!editingLot && productoElegido && !productoElegido.permite_lotes && (
              <p className="text-[11px] text-muted-foreground">
                Al guardar se activará &quot;Maneja lotes y caducidad&quot; en este producto.
              </p>
            )}
          </div>

          {!editingLot && variantesDelProducto.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Variante *</Label>
              <SelectSimple
                value={form.variante_id || null}
                onChange={(v) => set("variante_id", v ?? "")}
                placeholder="¿De qué variante es el lote?"
                opciones={variantesDelProducto.map((v) => ({ value: v.id, label: v.etiqueta }))}
              />
            </div>
          )}

          {!editingLot && (
            <CampoSucursal
              id="lote-sucursal"
              value={form.sucursal_id}
              onChange={(id) => set("sucursal_id", id)}
              etiqueta="Sucursal *"
              ayuda="Dónde está físicamente el lote."
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Número de lote *</Label>
              <Input
                placeholder="LOTE-001"
                value={form.numero_lote}
                onChange={(e) => set("numero_lote", e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad {editingLot ? "" : "*"}</Label>
              {editingLot ? (
                <p className="flex h-8 items-center font-mono text-sm text-muted-foreground">
                  {Number(editingLot.cantidad)}
                </p>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={form.cantidad}
                  onChange={(e) => set("cantidad", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              )}
            </div>
          </div>

          {!editingLot && (
            <div className="space-y-1.5">
              <Label className="text-xs">¿De dónde salen estas piezas?</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  {
                    valor: false,
                    titulo: "Ya están en mi inventario",
                    detalle: "Solo les pongo número de lote y caducidad.",
                  },
                  {
                    valor: true,
                    titulo: "Es mercancía nueva",
                    detalle: "Además se suman al inventario.",
                  },
                ].map((op) => (
                  <button
                    key={String(op.valor)}
                    type="button"
                    onClick={() => set("suma_stock", op.valor)}
                    aria-pressed={form.suma_stock === op.valor}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      form.suma_stock === op.valor
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="block text-xs font-medium">{op.titulo}</span>
                    <span className="block text-[11px] text-muted-foreground">{op.detalle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de fabricación</Label>
              <Input
                type="date"
                value={form.fecha_fabricacion}
                onChange={(e) => set("fecha_fabricacion", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de caducidad</Label>
              <Input
                type="date"
                value={form.fecha_caducidad}
                onChange={(e) => set("fecha_caducidad", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Costo unitario</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.costo_unitario}
              onChange={(e) => set("costo_unitario", e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleSave}
            disabled={saving || (!editingLot && sinProductos)}
          >
            {saving ? "Guardando..." : editingLot ? "Guardar cambios" : "Registrar lote"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
