"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensajeDeError } from "@/features/inventory/error-message";
import { SucursalesCheckboxes } from "./sucursales-checkboxes";

/**
 * Cambiar las sucursales de un usuario que ya existe (cuando rota de local).
 *
 * Pasa por `asignar_sucursales_usuario`, que exige `org.manage_members_write` y
 * valida que cada sucursal sea del negocio. Sustituye la asignacion entera:
 * lo que no se marca aqui deja de estar asignado.
 *
 * Se monta con `key` por usuario desde la pagina, asi que el estado inicial sale
 * de las props sin un efecto que lo sincronice.
 */
export function AsignarSucursalesDialog({
  open,
  onOpenChange,
  tenantId,
  userId,
  email,
  asignadas,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  userId: string;
  email: string;
  asignadas: string[];
  onSaved: () => void;
}) {
  const [seleccion, setSeleccion] = useState<string[]>(asignadas);
  const t = useTranslations("users.ui");
  const te = useTranslations("inventory.errors");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("asignar_sucursales_usuario", {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_sucursales: seleccion,
      });
      if (error) throw error;
      toast.success(
        seleccion.length === 0
          ? t("allBranchesSaved", { nombre: email })
          : t("branchesSaved", { nombre: email })
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(mensajeDeError(error, te));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{t("branchesOf", { nombre: email })}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("branchesDesc")}
          </DialogDescription>
        </DialogHeader>
        <SucursalesCheckboxes value={seleccion} onChange={setSeleccion} idPrefix={`asig-${userId}`} />
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <SpecularActionButton tone="add" className="h-8" disabled={guardando} onClick={() => void guardar()}>
            {guardando ? t("saving") : t("save")}
          </SpecularActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
