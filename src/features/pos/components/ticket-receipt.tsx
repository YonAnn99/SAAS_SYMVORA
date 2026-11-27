"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { Link } from "@/i18n/navigation";
import { clavePagoI18n } from "../ticket-format";
import { TicketCuerpo } from "./ticket-cuerpo";
import { useTicketConfigEfectiva } from "../use-ticket-config";
import type { SaleReceipt } from "../types/pos.types";
import { useImpresora } from "../impresora/use-impresora";
import { imprimirTicketVenta } from "../impresora/imprimir-ticket";

interface TicketReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: SaleReceipt | null;
  /**
   * Venta recien cobrada en el POS: con impresora conectada y "Imprimir al
   * cobrar" activo, el ticket sale solo al abrirse. La reimpresion desde
   * Reportes no lo pasa: ahi nunca imprime sin pedirlo.
   */
  autoImprimir?: boolean;
}

export function TicketReceipt({
  open,
  onOpenChange,
  receipt,
  autoImprimir = false,
}: TicketReceiptProps) {
  const t = useTranslations();
  const { tenantName, tenantLogo, tenantAddress, moneda } = useCurrentTenant();
  const ticketConfig = useTicketConfigEfectiva();
  const impresora = useImpresora();
  const { can } = usePermissions();
  // Directo solo si hay impresora guardada y ESTE navegador tiene su conexion
  // (en iPhone, por ejemplo, no): si no, la ventana de impresion de siempre.
  const directo =
    impresora.config !== null && impresora.soportadas.includes(impresora.config.tipo);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [impreso, setImpreso] = useState<string | null>(null);
  const autoHecho = useRef<string | null>(null);

  const imprimirDirecto = async () => {
    if (!receipt || !impresora.config) return;
    setImprimiendo(true);
    try {
      await imprimirTicketVenta({
        config: impresora.config,
        receipt,
        negocio: { nombre: tenantName ?? "", direccion: tenantAddress, moneda },
        metodoPagoTexto: t(clavePagoI18n(receipt.paymentMethod)),
        logoUrl: tenantLogo,
        ticketConfig,
      });
      setImpreso(receipt.reference ?? "impreso");
    } catch {
      // Apagada o fuera de alcance: la ventana normal queda como respaldo.
      toast.error(t("pos.receipt.printError"), {
        action: { label: t("pos.receipt.usePrintWindow"), onClick: () => window.print() },
      });
    } finally {
      setImprimiendo(false);
    }
  };

  const imprimir = () => {
    if (directo) void imprimirDirecto();
    else window.print();
  };

  // Impresion automatica al cobrar: una sola vez por venta.
  const claveVenta = receipt ? receipt.reference ?? String(receipt.total) : null;
  useEffect(() => {
    if (!open || !autoImprimir || !directo || !impresora.config?.auto || !claveVenta) return;
    if (autoHecho.current === claveVenta) return;
    autoHecho.current = claveVenta;
    void imprimirDirecto();
    // Solo al abrir el ticket de una venta nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, claveVenta, autoImprimir, directo]);

  // `document` no existe en el servidor: el portal solo puede crearse ya
  // montado en el cliente.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);

  if (!receipt) return null;

  // El contenido del ticket se usa DOS veces: como vista previa en el diálogo y en el contenedor de
  // impresión. Es el mismo componente para que lo que se ve y lo que sale no puedan divergir.
  const cuerpoTicket = (
    <TicketCuerpo
      receipt={receipt}
      negocio={{ nombre: tenantName ?? "", logo: tenantLogo, direccion: tenantAddress, moneda }}
      config={ticketConfig}
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-emerald-500" />
              {t("pos.checkout.saleDone")}
            </DialogTitle>
          </DialogHeader>

          <div className="ticket-preview max-h-[55vh] overflow-y-auto rounded-lg bg-white p-4 text-black">
            {cuerpoTicket}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="h-8 w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              {t("pos.terminal.accept")}
            </Button>
            <SpecularActionButton
              tone="money"
              className="h-8 w-full sm:w-auto"
              onClick={imprimir}
              disabled={imprimiendo}
            >
              {imprimiendo ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5 mr-1.5" />
              )}
              {impreso === (receipt.reference ?? "impreso") ? t("pos.receipt.reprint") : t("pos.receipt.print")}
            </SpecularActionButton>
          </DialogFooter>
          {/* Sin impresora pero con un navegador que podria usarla: se dice
              donde conectarla (el boton dejo de estar en la barra del POS). */}
          {!directo && impresora.soportadas.length > 0 && can("org.manage_settings") && (
            <p className="-mt-2 text-center text-[11px] text-muted-foreground">
              {t("pos.receipt.havePrinter")}{" "}
              <Link href="/settings?tab=printer" className="underline hover:text-foreground">
                {t("pos.receipt.connectPrinter")}
              </Link>
            </p>
          )}
          {directo && (
            <p className="-mt-2 text-center text-[11px] text-muted-foreground">
              {imprimiendo
                ? t("pos.receipt.printingOn", { nombre: impresora.config?.nombre ?? t("pos.receipt.thePrinter") })
                : impreso === (receipt.reference ?? "impreso")
                  ? t("pos.receipt.printedOn", { nombre: impresora.config?.nombre ?? t("pos.receipt.thePrinter") })
                  : t("pos.receipt.printsDirect", { nombre: impresora.config?.nombre ?? t("pos.receipt.thePrinter") })}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/*
        El ticket que se imprime de verdad, FUERA del diálogo.

        Va por PORTAL a `document.body` y eso no es un detalle: la regla de
        impresión oculta `body > *` y reexpone solo este nodo. Si colgara del
        árbol de React quedaría varios divs adentro, su ancestro se ocultaría y
        el ticket no se imprimiría por mucho `display:block` que llevara encima.
        Como hijo directo de `body`, el selector lo alcanza.

        Tampoco vale imprimir el contenido del diálogo: vive en otro portal con
        `position: fixed` y transforms, y el navegador lo recorta.
      */}
      {open && montado
        ? createPortal(
            <div id="ticket-impresion">{cuerpoTicket}</div>,
            document.body
          )
        : null}
    </>
  );
}
