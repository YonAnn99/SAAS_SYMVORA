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
import { useModulos } from "@/hooks/use-modulos";
import type { Cliente } from "@/lib/types/database";
import { updateCustomer } from "../services/customer-service";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormEdicion {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  limite_credito: string;
}

function desdeCliente(c: Cliente): FormEdicion {
  return {
    nombre: c.nombre,
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    direccion: c.direccion ?? "",
    limite_credito: String(Number(c.limite_credito ?? 0)),
  };
}

/**
 * Editar los datos de un cliente desde Clientes. Solo se monta con un cliente
 * elegido (`cliente !== null`), asi el formulario arranca con SUS datos.
 */
export function EditCustomerDialog({
  cliente,
  onOpenChange,
  onSaved,
}: {
  cliente: Cliente | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (cliente: Cliente) => void;
}) {
  if (!cliente) return null;
  return <Formulario key={cliente.id} cliente={cliente} onOpenChange={onOpenChange} onSaved={onSaved} />;
}

function Formulario({
  cliente,
  onOpenChange,
  onSaved,
}: {
  cliente: Cliente;
  onOpenChange: (open: boolean) => void;
  onSaved: (cliente: Cliente) => void;
}) {
  const t = useTranslations();
  const { modulos } = useModulos();
  const [form, setForm] = useState<FormEdicion>(() => desdeCliente(cliente));
  const [saving, setSaving] = useState(false);
  // El limite de credito solo tiene sentido con fiado encendido, o si este
  // cliente ya tiene uno (no se esconde un dato que existe).
  const verLimite = modulos.permite_credito_fiado || Number(cliente.limite_credito) > 0;

  const cambiar = (campo: keyof FormEdicion, valor: string) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    const nombre = form.nombre.trim();
    const email = form.email.trim();
    const limite = Number(form.limite_credito || 0);
    if (!nombre) {
      toast.error("El nombre del cliente es requerido");
      return;
    }
    if (email && !CORREO.test(email)) {
      toast.error("Revisa el correo: no parece válido");
      return;
    }
    if (!Number.isFinite(limite) || limite < 0) {
      toast.error("El límite de crédito debe ser 0 o más");
      return;
    }

    setSaving(true);
    try {
      const actualizado = await updateCustomer(cliente.id, {
        nombre,
        telefono: form.telefono.trim() || null,
        email: email || null,
        direccion: form.direccion.trim() || null,
        limite_credito: Math.round(limite * 100) / 100,
      });
      void logActivity({
        action: "UPDATE",
        entity: "cliente",
        entityId: cliente.id,
        entityName: actualizado.nombre,
      });
      toast.success(`Cliente ${actualizado.nombre} actualizado`);
      onSaved(actualizado);
      onOpenChange(false);
    } catch (error: unknown) {
      const mensaje = (error as { message?: string } | null)?.message;
      toast.error(mensaje || "No se pudo actualizar el cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Corrige sus datos de contacto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ec-nombre">Nombre*</Label>
            <Input id="ec-nombre" value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-tel">Teléfono</Label>
            <Input
              id="ec-tel"
              inputMode="tel"
              value={form.telefono}
              onChange={(e) => cambiar("telefono", e.target.value)}
              placeholder="55 0000 0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-email">Correo</Label>
            <Input
              id="ec-email"
              type="email"
              value={form.email}
              onChange={(e) => cambiar("email", e.target.value)}
              placeholder="cliente@correo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-dir">Dirección</Label>
            <Input id="ec-dir" value={form.direccion} onChange={(e) => cambiar("direccion", e.target.value)} />
          </div>
          {verLimite && (
            <div className="space-y-1.5">
              <Label htmlFor="ec-limite">Límite de crédito</Label>
              <Input
                id="ec-limite"
                type="number"
                min={0}
                step="0.01"
                value={form.limite_credito}
                onChange={(e) => cambiar("limite_credito", e.target.value)}
                className="font-mono"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <SpecularActionButton tone="add" className="h-8" onClick={guardar} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
