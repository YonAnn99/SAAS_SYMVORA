"use client";

/**
 * Switches de módulos por usuario, para el SUPER_ADMIN.
 *
 * Distingue visualmente lo que viene **del rol** de lo que es una **excepción
 * manual**. Sin esa distinción, en unos meses nadie sabría por qué un usuario
 * ve lo que ve: el rol dejó de contar toda la historia desde la migración 055.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MODULES, type ModuleDefinition } from "@/lib/modules";
import type { UserRole } from "@/lib/types/database";

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserRole: UserRole;
  onSaved: () => void;
}

/** Permisos que el rol concede de fábrica. Espejo de `role_permissions`. */
const ROLE_BASE: Record<UserRole, string[]> = {
  SUPER_ADMIN: [],
  ORG_ADMIN: [
    "sales.create", "sales.view_reports", "sales.void",
    "inventory.view", "inventory.manage", "purchases.manage",
    "finances.manage", "org.manage_settings", "org.manage_members",
    "billing.view", "billing.create", "billing.stamp", "billing.cancel", "billing.config",
  ],
  CAJERO: ["sales.create", "sales.view_reports", "inventory.view", "billing.view"],
};

export function PermissionsDialog({
  open,
  onOpenChange,
  tenantId,
  targetUserId,
  targetUserEmail,
  targetUserRole,
  onSaved,
}: PermissionsDialogProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const grantable = useMemo(() => MODULES.filter((m) => m.grantable), []);
  const locked = useMemo(() => MODULES.filter((m) => !m.grantable), []);

  const byRole = useMemo(
    () => new Set(ROLE_BASE[targetUserRole] ?? []),
    [targetUserRole]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("user_permission_overrides")
        .select("permission, granted")
        .eq("tenant_id", tenantId)
        .eq("user_id", targetUserId);

      if (cancelled) return;

      // Estado inicial = lo que da el rol, con las excepciones aplicadas encima.
      const state: Record<string, boolean> = {};
      for (const mod of grantable) {
        if (mod.permission) state[mod.permission] = byRole.has(mod.permission);
      }
      for (const o of data ?? []) {
        state[o.permission] = o.granted;
      }
      setEnabled(state);
      setLoading(false);
    };

    const timeout = window.setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, tenantId, targetUserId, grantable, byRole]);

  const save = async () => {
    setSaving(true);
    try {
      // Solo se manda lo que DIFIERE del rol. Guardar una excepción que coincide
      // con el rol sería ruido, y peor: congelaría ese permiso si algún día
      // cambian los permisos del rol.
      const overrides = grantable
        .filter((m) => m.permission)
        .filter((m) => enabled[m.permission!] !== byRole.has(m.permission!))
        .map((m) => ({ permission: m.permission!, granted: enabled[m.permission!] }));

      const res = await fetch(`/api/users/${targetUserId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, overrides }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al guardar");

      toast.success(
        overrides.length === 0
          ? "Permisos restablecidos a los del rol"
          : `${overrides.length} ${overrides.length === 1 ? "excepción guardada" : "excepciones guardadas"}`
      );
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (mod: ModuleDefinition) => {
    const permission = mod.permission!;
    const value = enabled[permission] ?? false;
    const fromRole = byRole.has(permission);
    const isException = value !== fromRole;

    return (
      <div key={mod.key} className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{mod.label}</span>
            {isException && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                manual
              </span>
            )}
            {!isException && fromRole && (
              <span className="text-[10px] text-muted-foreground">por rol</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{mod.description}</p>
        </div>
        <Switch
          checked={value}
          onCheckedChange={(v) => setEnabled((s) => ({ ...s, [permission]: v }))}
          disabled={loading || saving}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permisos de {targetUserEmail}</DialogTitle>
          <DialogDescription>
            Rol actual: <strong>{targetUserRole}</strong>. Los switches son
            excepciones sobre lo que ese rol concede.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border">{grantable.map(renderRow)}</div>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
            <Lock className="h-3 w-3 shrink-0" />
            No se pueden conceder
          </p>
          {locked
            .filter((m) => m.notGrantableReason)
            .map((m) => (
              <p key={m.key} className="text-xs text-muted-foreground">
                <strong>{m.label}:</strong> {m.notGrantableReason}
              </p>
            ))}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Los cambios se aplican de inmediato, también en la base de datos: no
          es solo lo que la persona ve, sino lo que puede hacer.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={loading || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
