"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
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
import type { Cliente } from "@/lib/types/database";
import { createCustomer } from "../services/customer-service";
import {
  EMPTY_NEW_CUSTOMER,
  type NewCustomerForm,
} from "../types/customer.types";
import { FiscalDataForm } from "./fiscal-data-form";

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  onCreated: (customer: Cliente) => void;
}

export function NewCustomerDialog({
  open,
  onOpenChange,
  tenantId,
  onCreated,
}: NewCustomerDialogProps) {
  const t = useTranslations();
  const [form, setForm] = useState<NewCustomerForm>(EMPTY_NEW_CUSTOMER);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!tenantId) return;
    if (!form.nombre.trim()) {
      toast.error("El nombre del cliente es requerido");
      return;
    }
    setSaving(true);
    try {
      const customer = await createCustomer(tenantId, form);
      await logActivity({
        action: "CREATE",
        entity: "cliente",
        entityName: customer.nombre,
        details: { email: form.email, telefono: form.telefono },
      });
      toast.success(`Cliente ${customer.nombre} creado`);
      onCreated(customer);
      onOpenChange(false);
      setForm(EMPTY_NEW_CUSTOMER);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear el cliente"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Crea un cliente y registra sus datos fiscales para facturar
            (opcional).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-nombre">Nombre*</Label>
              <Input
                id="nc-nombre"
                value={form.nombre}
                onChange={(e) =>
                  setForm({ ...form, nombre: e.target.value })
                }
                placeholder="Nombre o razón de la persona"
              />
            </div>
            <FiscalDataForm value={form} onChange={setForm} />
            <div className="space-y-1.5">
              <Label htmlFor="nc-tel">Teléfono</Label>
              <Input
                id="nc-tel"
                value={form.telefono}
                onChange={(e) =>
                  setForm({ ...form, telefono: e.target.value })
                }
                placeholder="55 0000 0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">Email</Label>
              <Input
                id="nc-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@correo.com"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            className="h-8 active:scale-[0.98] transition-transform"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}