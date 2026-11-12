"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Copy, ExternalLink, Loader2, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { TarjetaVisual } from "@/features/lealtad/components/tarjeta-visual";
import { textoProgreso, urlTarjeta } from "@/features/lealtad/lealtad";
import { qrSvg } from "@/features/lealtad/qr";
import type { ProgramaLealtad } from "@/features/lealtad/types";

export interface TarjetaParaVentana {
  id: string;
  codigo: string;
  sellos: number;
  clienteNombre: string;
  clienteEmail: string | null;
}

/**
 * La tarjeta de un cliente para entregarsela: la ve como la vera el, con el
 * QR, y se comparte por enlace (WhatsApp desde el celular) o por correo.
 */
export function VentanaTarjeta({
  tarjeta,
  programa,
  onOpenChange,
}: {
  tarjeta: TarjetaParaVentana | null;
  programa: ProgramaLealtad;
  onOpenChange: (abierta: boolean) => void;
}) {
  const locale = useLocale();
  const { tenantId, tenantName, tenantLogo } = useCurrentTenant();
  const t = useTranslations("customers.loyalty.cardWindow");
  const [svg, setSvg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // En el navegador el enlace usa el origen actual: en localhost apunta a
  // localhost y en produccion al dominio de la app.
  const url = tarjeta
    ? urlTarjeta(tarjeta.codigo, locale, typeof window !== "undefined" ? window.location.origin : undefined)
    : "";

  useEffect(() => {
    if (!url) return;
    let vigente = true;
    qrSvg(url).then((s) => vigente && setSvg(s));
    return () => {
      vigente = false;
    };
  }, [url]);

  if (!tarjeta) return null;

  const mensaje = `${tenantName}: ${textoProgreso(tarjeta.sellos, programa.sellos_meta, programa.premio_descripcion)}. Tu tarjeta de lealtad: ${url}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyError"));
    }
  };

  // Compartir nativo en el celular (ofrece WhatsApp, SMS...); en escritorio,
  // WhatsApp Web con el mensaje listo.
  const compartir = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: programa.nombre, text: mensaje });
        return;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
  };

  const enviarCorreo = async () => {
    setEnviando(true);
    try {
      const res = await fetch("/api/lealtad/enviar-tarjeta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, tarjetaId: tarjeta.id, locale }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? t("sendError"));
      toast.success(t("sent", { email: tarjeta.clienteEmail ?? "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sendError"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{t("title", { nombre: tarjeta.clienteNombre })}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <TarjetaVisual
            compacta
            datos={{
              negocio: tenantName,
              logoUrl: tenantLogo,
              programa: programa.nombre,
              paleta: programa.paleta,
              colorAcento: programa.color_acento,
              iconoSello: programa.icono_sello,
              colorFondo: programa.color_fondo,
              sellos: tarjeta.sellos,
              sellosMeta: programa.sellos_meta,
              premio: programa.premio_descripcion,
              cliente: tarjeta.clienteNombre.split(/\s+/)[0],
              codigo: tarjeta.codigo,
              qrSvg: svg,
              activa: programa.activo,
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copiar}>
            <Copy className="h-3.5 w-3.5" />
            {t("copy")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={compartir}>
            <Share2 className="h-3.5 w-3.5" />
            {t("share")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("open")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!tarjeta.clienteEmail || enviando}
            title={tarjeta.clienteEmail ? t("sendTo", { email: tarjeta.clienteEmail }) : t("noEmail")}
            onClick={enviarCorreo}
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            {t("byEmail")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
