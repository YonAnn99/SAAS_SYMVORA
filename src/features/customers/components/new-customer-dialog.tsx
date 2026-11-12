"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { logActivity } from "@/lib/supabase/activity-logger";
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
import type { Cliente } from "@/lib/types/database";
import { createCustomer } from "../services/customer-service";
import {
  EMPTY_NEW_CUSTOMER,
  type NewCustomerForm,
} from "../types/customer.types";

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
      toast.error(t("customers.form.nameRequired"));
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error(t("customers.form.emailInvalid"));
      return;
    }
    setSaving(true);
    try {
      const customer = await createCustomer(tenantId, form);
      await logActivity({
        action: "CREATE",
        entity: "cliente",
        entityName: customer.nombre,
        details: { telefono: form.telefono },
      });
      toast.success(t("customers.form.created", { nombre: customer.nombre }));
      onCreated(customer);
      onOpenChange(false);
      setForm(EMPTY_NEW_CUSTOMER);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("customers.form.createError")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("customers.selector.new")}</DialogTitle>
          <DialogDescription>{t("customers.form.newDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-nombre">{t("customers.form.name")}</Label>
            <Input
              id="nc-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder={t("customers.form.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-tel">{t("customers.form.phone")}</Label>
            <Input
              id="nc-tel"
              value={form.telefono}
              onChange={(e) =>
                setForm({ ...form, telefono: e.target.value })
              }
              placeholder="55 0000 0000"
            />
          </div>
          {/* Para mandarle su tarjeta de lealtad por correo, entre otras cosas. */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-email">{t("customers.form.emailOptional")}</Label>
            <Input
              id="nc-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t("customers.form.emailPlaceholder")}
            />
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
          <SpecularActionButton
            tone="add"
            className="h-8"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? t("customers.form.saving") : t("customers.form.create")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}