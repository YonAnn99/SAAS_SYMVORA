"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { User, Shield, KeyRound, Building2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useTenantContext } from "@/contexts/tenant-context";
import { usePermissions } from "@/hooks/use-permissions";
import { convertToWebP } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FileUpload } from "@/components/ui/file-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const { tenantId, tenantName, tenantLogo, role } = useCurrentTenant();
  const { refetch: refetchTenant } = useTenantContext();
  const { can } = usePermissions();

  const canManageSettings =
    role === "SUPER_ADMIN" || role === "ORG_ADMIN" || can("org.manage_settings");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("account");

  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setActiveTab("account");
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

      // Disparar la notificación por correo electrónico de seguridad
      if (tenantId) {
        void fetch("/api/email/password-changed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId }),
        }).catch((emailErr) => {
          console.error("Error al despachar aviso de seguridad por correo:", emailErr);
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar la contraseña"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!tenantId) return;
    setLogoUploading(true);

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("No se pudo identificar al usuario actual");
      setLogoUploading(false);
      return;
    }

    try {
      const webpFile = await convertToWebP(file);
      const filePath = `${user.id}/logo.webp`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, webpFile, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        toast.error("Error al subir el logo: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: urlData.publicUrl })
        .eq("id", tenantId);

      if (updateError) {
        toast.error("Error al guardar el logo: " + updateError.message);
        return;
      }

      await refetchTenant();
      toast.success("Logo actualizado correctamente");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al procesar el logo"
      );
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!tenantId) return;
    setLogoUploading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("tenants")
      .update({ logo_url: null })
      .eq("id", tenantId);

    if (error) {
      toast.error("Error al quitar el logo: " + error.message);
    } else {
      await refetchTenant();
      toast.success("Logo eliminado");
    }
    setLogoUploading(false);
  };

  const currentRole = role
    ? roleBadges[role] || { label: role, className: "bg-muted text-muted-foreground" }
    : null;

  // Renderizador del contenido de la cuenta (nombre y contraseña)
  const renderAccountContent = () => (
    <div className="space-y-4 pt-1">
      {/* Sección: Datos personales */}
      <form onSubmit={handleUpdateName} className="space-y-2">
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
      </form>

      <Separator className="my-2" />

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
    </div>
  );

  // Renderizador del contenido de gestión de logo
  const renderLogoContent = () => (
    <div className="space-y-3 pt-1">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Sube o actualiza el logotipo oficial de tu negocio. Se reflejará automáticamente en tickets de venta, punto de venta y encabezado.
        </p>
      </div>

      <FileUpload
        preview={tenantLogo ?? null}
        onFileSelect={handleLogoUpload}
        onFileRemove={handleLogoRemove}
        dragDropText={t("auth.logoDragDrop")}
        maxSizeText={t("auth.logoMaxSize")}
      />

      {logoUploading && (
        <p className="text-xs text-muted-foreground animate-pulse text-center">
          {t("common.loading")}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Mi Perfil
          </DialogTitle>
          <DialogDescription className="text-xs">
            Consulta los datos de tu cuenta y gestiona tus credenciales y configuración
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
              <span className="truncate">
                Negocio: <strong className="text-foreground font-medium">{tenantName}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Contenido con Pestañas si tiene permisos de configuración */}
        {canManageSettings ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="account" className="text-xs flex items-center gap-1.5 cursor-pointer">
                <User className="h-3.5 w-3.5" />
                Mi Cuenta
              </TabsTrigger>
              <TabsTrigger value="logo" className="text-xs flex items-center gap-1.5 cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5" />
                Logo del Negocio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              {renderAccountContent()}
            </TabsContent>

            <TabsContent value="logo">
              {renderLogoContent()}
            </TabsContent>
          </Tabs>
        ) : (
          renderAccountContent()
        )}

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
