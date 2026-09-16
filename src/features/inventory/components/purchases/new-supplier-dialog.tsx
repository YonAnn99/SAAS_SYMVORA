"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { normalizarTelefonoMx } from "@/lib/whatsapp";
import type { Proveedor, SupplierFormData } from "../../types/inventory.types";

interface NewSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (formData: SupplierFormData) => void;
  editingSupplier?: Proveedor | null;
}

export function NewSupplierDialog({
  open,
  onOpenChange,
  onConfirm,
  editingSupplier,
}: NewSupplierDialogProps) {
  const isEditing = !!editingSupplier;

  const [formData, setFormData] = useState<SupplierFormData>({
    nombre: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      if (editingSupplier) {
        setFormData({
          nombre: editingSupplier.nombre,
          email: editingSupplier.email || "",
          phone: editingSupplier.telefono || "",
        });
      } else {
        setFormData({ nombre: "", email: "", phone: "" });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, editingSupplier]);

  const updateField = (field: keyof SupplierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFormData({ nombre: "", email: "", phone: "" });
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!formData.nombre.trim()) {
      toast.error("Ingresa el nombre del proveedor");
      return;
    }
    // El celular se valida AL CAPTURARLO, no al querer usarlo. Antes un numero
    // mal escrito se guardaba sin chistar y el problema salia mucho despues:
    // el boton de WhatsApp de la orden simplemente no aparecia, sin explicar
    // por que.
    if (!normalizarTelefonoMx(formData.phone)) {
      toast.error("Escribe un celular de 10 dígitos para poder mandarle pedidos");
      return;
    }
    onConfirm({ ...formData, nombre: formData.nombre.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEditing ? "Editar proveedor" : "Agregar proveedor"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Actualiza la información del proveedor"
              : "Registra un nuevo proveedor en tu catálogo"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre *</Label>
            <Input
              placeholder="Nombre del proveedor"
              value={formData.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          {/* El celular va ANTES del email: es el dato que de verdad se usa
              (mandar el pedido por WhatsApp), y el orden del formulario le dice
              al usuario qué importa. */}
          <div className="space-y-1.5">
            <Label className="text-xs">Celular *</Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="55 1234 5678"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Con este número podrás mandarle los pedidos por WhatsApp.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email (opcional)</Label>
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="h-8 text-sm"
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
          <SpecularActionButton tone="add" className="h-8" onClick={handleConfirm}>
            {isEditing ? "Guardar cambios" : "Guardar proveedor"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}