"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";

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
  const t = useTranslations("account.delete");
  const li = localeIntl(useLocale());

  if (isDemo) return null;
  const esDueno = role === "SUPER_ADMIN";
  const listo = confirmacion.trim().toUpperCase() === t("confirmWord");

  async function solicitar() {
    setEnviando(true);
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conservar_contacto: !noConservar, motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("requestError"));
      toast.success(t("requested", { fecha: fechaLegible(data.ejecutar_en, li) }));
      setAbierto(false);
      avisarCambioDeBaja();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("requestError"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
          {t("title")}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {esDueno
            ? t("ownerDesc", { negocio: tenantName ? ` «${tenantName}»` : "", dias: DIAS_PLAZO_BAJA })
            : t("memberDesc", { dias: DIAS_PLAZO_BAJA })}
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
          {t("title")}
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>
              {esDueno
                ? `${t("ownerBlocked")} `
                : `${t("memberBlocked")} `}
              {t("finalDeletion", { dias: DIAS_PLAZO_BAJA })}
              {esDueno ? ` ${t("canDownload")}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="motivo-baja" className="text-xs">
                {t("reason")}
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
                {t.rich("keepContact", { b: (chunks) => <strong>{chunks}</strong> })}
              </span>
            </label>

            <div className="space-y-1">
              <Label htmlFor="confirmar-baja" className="text-xs">
                {t.rich("typeToConfirm", { palabra: t("confirmWord"), b: (chunks) => <strong>{chunks}</strong> })}
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
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={!listo || enviando} onClick={() => void solicitar()}>
              {enviando ? t("sending") : t("title")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
