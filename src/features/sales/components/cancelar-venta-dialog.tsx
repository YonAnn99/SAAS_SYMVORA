"use client";

/**
 * Motivo y confirmación para cancelar o corregir una venta (migración 137).
 *
 * - «Cancelar»: llama a `cancelar_venta` aquí mismo y avisa qué pasó con el
 *   dinero, el crédito y la tarjeta de lealtad.
 * - «Corregir»: guarda la corrección pendiente y lleva al Punto de Venta, que
 *   carga la venta en el carrito. La original se cancela hasta cobrar la nueva.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMoneda } from "@/hooks/use-moneda";
import { useRouter } from "@/i18n/navigation";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { mensajeDeError } from "@/features/inventory/error-message";
import { numeroOperacion } from "@/features/pos/ticket-format";
import {
  MOTIVO_MAXIMO,
  MOTIVOS_CANCELACION,
  avisosCancelacion,
  avisosPrevios,
  motivoParaGuardar,
  type MotivoCancelacion,
  type RespuestaCancelacion,
} from "../cancelar-venta";
import { cancelarVenta } from "../services/sales-history-service";
import { guardarCorreccion } from "../correccion";
import type { VentaGuardada } from "../sale-receipt-builder";

interface CancelarVentaDialogProps {
  venta: VentaGuardada | null;
  modo: "cancelar" | "corregir" | null;
  onOpenChange: (abierta: boolean) => void;
  /** Tras cancelar: para refrescar el detalle y el historial. */
  onCancelada?: (respuesta: RespuestaCancelacion) => void;
}

export function CancelarVentaDialog({ venta, modo, onOpenChange, onCancelada }: CancelarVentaDialogProps) {
  const t = useTranslations("reports.sale.cancel");
  const te = useTranslations("inventory.errors");
  const { formatear } = useMoneda();
  const router = useRouter();
  const { userId } = useCurrentTenant();
  const [motivo, setMotivo] = useState<MotivoCancelacion | null>(null);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);

  const abierta = Boolean(venta && modo);
  const texto = motivoParaGuardar(motivo, detalle);
  const numero = venta ? numeroOperacion(venta.id) ?? "" : "";

  const cerrar = (valor: boolean) => {
    if (enviando) return;
    if (!valor) {
      setMotivo(null);
      setDetalle("");
    }
    onOpenChange(valor);
  };

  const confirmar = async () => {
    if (!venta || !texto) return;
    if (modo === "corregir") {
      if (!userId) return;
      guardarCorreccion({ ventaId: venta.id, motivo: texto, userId });
      cerrar(false);
      router.push("/pos");
      return;
    }
    setEnviando(true);
    try {
      const respuesta = await cancelarVenta(venta.id, texto);
      toast.success(t("done", { numero }));
      for (const aviso of avisosCancelacion(respuesta)) {
        const mensaje = t(`after.${aviso.codigo}`, { monto: formatear(aviso.monto ?? 0) });
        if (aviso.tono === "aviso") toast.warning(mensaje, { duration: 12000 });
        else toast.info(mensaje, { duration: 8000 });
      }
      setEnviando(false);
      cerrar(false);
      onCancelada?.(respuesta);
    } catch (error) {
      toast.error(mensajeDeError(error, te));
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierta} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {modo === "corregir" ? t("titleCorrect", { numero }) : t("title", { numero })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {modo === "corregir" ? t("descCorrect") : t("desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-medium">{t("reason")}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("reason")}>
              {MOTIVOS_CANCELACION.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={motivo === m}
                  onClick={() => setMotivo(m)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    motivo === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {t(`reasons.${m}`)}
                </button>
              ))}
            </div>
          </div>

          {motivo && (
            <Textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={MOTIVO_MAXIMO}
              rows={2}
              placeholder={motivo === "otro" ? t("detailRequired") : t("detailOptional")}
              className="text-sm"
            />
          )}

          {venta && (
            <ul className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {avisosPrevios({
                estado: venta.estado,
                metodo_pago: venta.metodo_pago,
                pagada_con_terminal: venta.pagada_con_terminal,
              }).map((a) => (
                <li key={a}>• {t(`before.${a}`, { monto: formatear(Number(venta.total)) })}</li>
              ))}
              {modo === "corregir" && <li>• {t("before.correct")}</li>}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => cerrar(false)} disabled={enviando}>
            {t("back")}
          </Button>
          <Button
            variant={modo === "corregir" ? "default" : "destructive"}
            disabled={!texto || enviando}
            onClick={() => void confirmar()}
          >
            {enviando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {modo === "corregir" ? t("confirmCorrect") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
