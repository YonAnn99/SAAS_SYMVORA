"use client";

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
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre no puede estar vacío");
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
      if (!response.ok) throw new Error(result.error || "Error al guardar el nombre");
      toast.success("Nombre actualizado");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar el nombre");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={guardar} className="contents">
          <DialogHeader>
            <DialogTitle className="text-base">Nombre del usuario</DialogTitle>
            <DialogDescription className="text-xs">
              Así aparecerá {email} en Usuarios, en el historial de ventas y en su saludo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="editar-nombre" className="text-xs">Nombre completo</Label>
            <Input
              id="editar-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              maxLength={120}
              autoComplete="off"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <SpecularActionButton
              type="submit"
              tone="neutral"
              className="h-8 active:scale-[0.98] transition-transform"
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </SpecularActionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
