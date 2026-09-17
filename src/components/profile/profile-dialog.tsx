"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { User, Shield, KeyRound, Building2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const roleBadges: Record<string, { label: string; className: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
  ORG_ADMIN: {
    label: "Administrador",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  CAJERO: {
    label: "Cajero",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
};

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const t = useTranslations();
  const { tenantName, role } = useCurrentTenant();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      return;
    }

    let isMounted = true;
    const fetchUser = async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && isMounted) {
        setEmail(user.email || "");
        const metaName =
          (user.user_metadata?.nombre_completo as string) ||
          (user.user_metadata?.full_name as string) ||
          "";
        setFullName(metaName);
      }
    };

    void fetchUser();

    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    setSavingName(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: { nombre_completo: fullName.trim(), full_name: fullName.trim() },
      });

      if (error) throw error;
      toast.success("Nombre actualizado correctamente");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el nombre"
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error("Ingresa la nueva contraseña");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      toast.success("Contraseña actualizada exitosamente");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar la contraseña"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const currentRole = role ? roleBadges[role] || { label: role, className: "bg-muted text-muted-foreground" } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Mi Perfil
          </DialogTitle>
          <DialogDescription className="text-xs">
            Consulta los datos de tu cuenta y gestiona tus credenciales de acceso
          </DialogDescription>
        </DialogHeader>

        {/* Resumen de cuenta y rol */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {fullName || "Usuario"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </div>

            {currentRole && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${currentRole.className}`}
              >
                <Shield className="h-3 w-3" />
                {currentRole.label}
              </span>
            )}
          </div>

          {tenantName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Negocio: <strong className="text-foreground font-medium">{tenantName}</strong></span>
            </div>
          )}
        </div>

        {/* Sección: Datos personales */}
        <form onSubmit={handleUpdateName} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nombre completo</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Tu nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={savingName}
                className="h-8 px-3 text-xs shrink-0 cursor-pointer"
              >
                {savingName ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </form>

        <Separator className="my-1" />

        {/* Sección: Seguridad / Contraseña */}
        <form onSubmit={handleUpdatePassword} className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            Cambiar Contraseña
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nueva contraseña</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-8 text-sm"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Confirmar nueva contraseña</Label>
              <Input
                type="password"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-8 text-sm"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <SpecularActionButton
              type="submit"
              tone="money"
              disabled={savingPassword || !newPassword}
              className="h-8 text-xs font-medium cursor-pointer"
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </SpecularActionButton>
          </div>
        </form>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs w-full sm:w-auto cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
