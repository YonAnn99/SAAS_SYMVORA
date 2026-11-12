"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * El dueño captura o corrige el nombre de alguien de su equipo. Sirve sobre
 * todo para las cuentas creadas antes de que la invitacion pidiera nombre.
 *
 * Pasa por `PATCH /api/users/[userId]/nombre` (solo SUPER_ADMIN, y solo
 * miembros de este negocio). Se monta con `key` por usuario desde la pagina:
 * el estado inicial sale de las props sin un efecto que lo sincronice.
 */
export function EditarNombreDialog({
  open,
  onOpenChange,
  tenantId,
  userId,
  email,
  nombreActual,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userId: string;
  email: string;
  nombreActual: string | null;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(nombreActual ?? "");
  const t = useTranslations("users.ui");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error(t("nameEmpty"));
      return;
    }
    setGuardando(true);
    try {
      const response = await fetch(`/api/users/${userId}/nombre`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, nombre: nombre.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("nameSaveError"));
      toast.success(t("nameSaved"));
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("nameSaveError"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="contents">
          <DialogHeader>
            <DialogTitle className="text-base">{t("nameTitle")}</DialogTitle>
            <DialogDescription className="text-xs">
              {t("nameDesc", { email })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="editar-nombre" className="text-xs">{t("fullName")}</Label>
            <Input
              id="editar-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              maxLength={120}
              autoComplete="off"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <SpecularActionButton
              type="submit"
              tone="neutral"
              className="h-8 active:scale-[0.98] transition-transform"
              disabled={guardando}
            >
              {guardando ? t("saving") : t("save")}
            </SpecularActionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
