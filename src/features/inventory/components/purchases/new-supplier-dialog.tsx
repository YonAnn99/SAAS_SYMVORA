"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("purchases.suppliers");
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
      toast.error(t("nameRequired"));
      return;
    }
    // El celular se valida AL CAPTURARLO, no al querer usarlo. Antes un numero
    // mal escrito se guardaba sin chistar y el problema salia mucho despues:
    // el boton de WhatsApp de la orden simplemente no aparecia, sin explicar
    // por que.
    if (!normalizarTelefonoMx(formData.phone)) {
      toast.error(t("phoneInvalid"));
      return;
    }
    onConfirm({ ...formData, nombre: formData.nombre.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEditing ? t("editTitle") : t("add")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? t("editDesc")
              : t("newDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("name")}</Label>
            <Input
              placeholder={t("namePlaceholder")}
              value={formData.nombre}
              onChange={(e) => updateField("nombre", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          {/* El celular va ANTES del email: es el dato que de verdad se usa
              (mandar el pedido por WhatsApp), y el orden del formulario le dice
              al usuario qué importa. */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("phoneRequired")}</Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="55 1234 5678"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("phoneHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("email")}</Label>
            <Input
              type="email"
              placeholder={t("emailPlaceholder")}
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
            {t("cancel")}
          </Button>
          <SpecularActionButton tone="add" className="h-8" onClick={handleConfirm}>
            {isEditing ? t("saveChanges") : t("save")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}