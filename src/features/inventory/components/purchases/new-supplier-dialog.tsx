"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import type { SupplierFormData } from "../../types/inventory.types";

interface NewSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (formData: SupplierFormData) => void;
}

export function NewSupplierDialog({
  open,
  onOpenChange,
  onConfirm,
}: NewSupplierDialogProps) {
  const [formData, setFormData] = useState<SupplierFormData>({
    nombre: "",
    contact: "",
    email: "",
    phone: "",
  });

  const updateField = (field: keyof SupplierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFormData({ nombre: "", contact: "", email: "", phone: "" });
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!formData.nombre) {
      toast.error("Ingresa el nombre del proveedor");
      return;
    }
    onConfirm(formData);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">Agregar proveedor</DialogTitle>
          <DialogDescription className="text-xs">
            Registra un nuevo proveedor en tu catálogo
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
          <div className="space-y-1.5">
            <Label className="text-xs">Contacto</Label>
            <Input
              placeholder="Nombre de contacto"
              value={formData.contact}
              onChange={(e) => updateField("contact", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teléfono</Label>
            <Input
              placeholder="+52 ..."
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
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
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={handleConfirm}
          >
            Guardar proveedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}