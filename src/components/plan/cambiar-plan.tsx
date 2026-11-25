"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectorNivel } from "@/components/plan/selector-nivel";
import { usePlan } from "@/hooks/use-plan";
import { SALES_WHATSAPP, SUPPORT_EMAIL } from "@/lib/contact";
import { formatPrecioNivel, type Nivel } from "@/lib/niveles";
import type { BillingPeriod } from "@/lib/pricing";
import {
  modoDeCambio,
  nivelCambiaAhora,
  precioDesdeProximoCobroMXN,
  tipoDeCambio,
} from "@/features/payments/cambio-de-plan";

/**
 * «Cambiar de plan» en Suscripcion, para quien YA paga (con los niveles encendidos). Las reglas viven en
 * `features/payments/cambio-de-plan.ts` y las aplica `POST /api/conekta/cambiar-plan`; esto solo pide
 * confirmacion con el precio nuevo y avisa desde cuando rige. Lo anual va por soporte.
 */
export function CambiarPlan({
  tenantId,
  periodo,
  tieneSuscripcionRecurrente,
  tienePromo,
  onCambiado,
  disabled,
}: {
  tenantId: string;
  periodo: BillingPeriod;
  tieneSuscripcionRecurrente: boolean;
  /** Tiene cobros promocionales por delante: cambiar de plan los pierde. */
  tienePromo: boolean;
  onCambiado: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const t = useTranslations("planes");
  const { nivel: actual, refrescar } = usePlan();
  const [elegido, setElegido] = useState<Nivel>(actual ?? "pro");
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const modo = modoDeCambio({ periodo, tieneSuscripcionRecurrente });
  const tipo = tipoDeCambio(actual, elegido);
  const ahora = modo === "tarjeta" && nivelCambiaAhora(tipo);
  const nombre = (n: Nivel) => t(`names.${n}`);

  const textoSoporte = (
    <p className="text-xs text-muted-foreground">
      {t("change.support", { correo: SUPPORT_EMAIL })}{" "}
      <a
        className="underline"
        href={`https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(t("change.supportMessage"))}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
    </p>
  );

  const mensajeDeError = (data: { error?: string; max?: number; usadas?: number }) => {
    if (data.error === "demasiadas_sucursales") {
      return t("errors.tooManyBranches", { max: data.max ?? 0, usadas: data.usadas ?? 0 });
    }
    if (data.error === "cambio_por_soporte") return t("change.supportOnly", { correo: SUPPORT_EMAIL });
    if (data.error === "conekta_no_pudo_cambiar") return t("change.providerFailed", { correo: SUPPORT_EMAIL });
    if (data.error === "demasiados_intentos") return t("change.tooMany");
    return t("change.failed", { correo: SUPPORT_EMAIL });
  };

  const cambiar = async () => {
    setGuardando(true);
    try {
      const respuesta = await fetch("/api/conekta/cambiar-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, nivel: elegido }),
      });
      const data = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        toast.error(mensajeDeError(data));
        return;
      }
      toast.success(
        data.aplicado_ya
          ? t("change.doneNow", { nivel: nombre(elegido) })
          : t("change.doneLater", { nivel: nombre(elegido) })
      );
      setConfirmando(false);
      await Promise.all([refrescar(), onCambiado()]);
    } catch {
      toast.error(t("change.failed", { correo: SUPPORT_EMAIL }));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t("change.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {actual ? t("change.current", { nivel: nombre(actual) }) : t("change.currentLegacy")}
        </p>
      </div>

      {modo === "soporte" ? (
        <>
          <p className="text-sm text-muted-foreground">{t("change.yearlyBySupport")}</p>
          {textoSoporte}
        </>
      ) : (
        <>
          <SelectorNivel
            nivel={elegido}
            periodo="monthly"
            onChange={setElegido}
            disabled={disabled || guardando}
            sinPromo
          />
          <Button
            className="w-full"
            disabled={disabled || guardando || tipo === "igual"}
            onClick={() => setConfirmando(true)}
          >
            {tipo === "igual" ? t("change.same") : t("change.cta", { nivel: nombre(elegido) })}
          </Button>
          {textoSoporte}
        </>
      )}

      <Dialog open={confirmando} onOpenChange={(abierto) => !guardando && setConfirmando(abierto)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("change.confirmTitle", { nivel: nombre(elegido) })}</DialogTitle>
            <DialogDescription>
              {t("change.confirmPrice", {
                precio: formatPrecioNivel(precioDesdeProximoCobroMXN(elegido, "monthly")),
              })}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              {modo === "pago_unico"
                ? t("change.whenOneTime")
                : ahora
                  ? t("change.whenUpgrade")
                  : t("change.whenDowngrade")}
            </li>
            {tienePromo && <li>{t("change.losesPromo")}</li>}
            {tipo === "baja" && <li>{t("change.noDataLost")}</li>}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={guardando}>
              {t("change.back")}
            </Button>
            <Button onClick={cambiar} disabled={guardando}>
              {guardando ? t("change.saving") : t("change.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
