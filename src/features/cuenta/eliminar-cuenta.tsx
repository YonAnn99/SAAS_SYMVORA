"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useIsDemo } from "@/hooks/use-is-demo";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { DIAS_PLAZO_BAJA, fechaLegible } from "./baja";
import { avisarCambioDeBaja } from "./use-solicitud-baja";

/**
 * «Eliminar mi cuenta» en Mi perfil. Lo exige Google Play (migracion 128).
 *
 * No borra al momento: deja una solicitud con 30 dias para arrepentirse. El
 * dueño cierra el NEGOCIO completo (y su suscripcion se cancela hoy); un
 * colaborador solo sale del negocio. Para confirmar hay que escribir ELIMINAR.
 *
 * La casilla de conservar el contacto va DESMARCADA: marcarla es oponerse. Lo
 * que dice el aviso de privacidad (v1.5, seccion 3) es que nombre y celular se
 * conservan para comunicaciones comerciales salvo que el titular se oponga.
 */
export function EliminarCuenta() {
  const isDemo = useIsDemo();
  const { role, tenantName } = useCurrentTenant();
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [noConservar, setNoConservar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (isDemo) return null;
  const esDueno = role === "SUPER_ADMIN";
  const listo = confirmacion.trim().toUpperCase() === "ELIMINAR";

  async function solicitar() {
    setEnviando(true);
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conservar_contacto: !noConservar, motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la solicitud");
      toast.success(`Listo. Tu cuenta se eliminará el ${fechaLegible(data.ejecutar_en)}.`);
      setAbierto(false);
      avisarCambioDeBaja();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la solicitud");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar mi cuenta
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {esDueno
            ? `Se eliminará tu cuenta y todo tu negocio${tenantName ? ` «${tenantName}»` : ""}: productos, ventas, clientes y la cuenta de tu equipo. Tienes ${DIAS_PLAZO_BAJA} días para arrepentirte.`
            : `Saldrás del negocio y tu cuenta se eliminará. Las ventas que registraste se quedan en el negocio. Tienes ${DIAS_PLAZO_BAJA} días para arrepentirte.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-red-500/40 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
          onClick={() => {
            setConfirmacion("");
            setAbierto(true);
          }}
        >
          Eliminar mi cuenta
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              {esDueno
                ? "Tu negocio quedará bloqueado desde hoy y tu suscripción se cancela. "
                : "Tu acceso quedará bloqueado desde hoy. "}
              El borrado definitivo es en {DIAS_PLAZO_BAJA} días; antes de eso puedes
              entrar y cancelar la solicitud.
              {esDueno ? " Durante ese plazo también puedes descargar tu información." : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="motivo-baja" className="text-xs">
                ¿Por qué te vas? (opcional)
              </Label>
              <Input
                id="motivo-baja"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
                className="h-9 text-sm"
              />
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Checkbox
                checked={noConservar}
                onCheckedChange={(v) => setNoConservar(v === true)}
                className="mt-0.5"
              />
              <span>
                SYMVORA conserva tu nombre y tu celular para avisarte de novedades y
                ofertas, como dice el aviso de privacidad. Marca esta casilla si
                <strong> no </strong>quieres que los conservemos.
              </span>
            </label>

            <div className="space-y-1">
              <Label htmlFor="confirmar-baja" className="text-xs">
                Escribe <strong>ELIMINAR</strong> para confirmar
              </Label>
              <Input
                id="confirmar-baja"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!listo || enviando} onClick={() => void solicitar()}>
              {enviando ? "Enviando…" : "Eliminar mi cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
