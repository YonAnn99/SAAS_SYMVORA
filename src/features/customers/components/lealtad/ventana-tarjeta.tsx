"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
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
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
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
      if (!res.ok) throw new Error(cuerpo?.error ?? "No se pudo enviar el correo");
      toast.success(`Tarjeta enviada a ${tarjeta.clienteEmail}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el correo");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Tarjeta de {tarjeta.clienteNombre}</DialogTitle>
          <DialogDescription className="text-xs">
            Compártele el enlace: la abre desde su celular, sin crear cuenta, y ve sus sellos al día.
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
            Copiar enlace
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={compartir}>
            <Share2 className="h-3.5 w-3.5" />
            Compartir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!tarjeta.clienteEmail || enviando}
            title={tarjeta.clienteEmail ? `Enviar a ${tarjeta.clienteEmail}` : "El cliente no tiene correo capturado"}
            onClick={enviarCorreo}
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Por correo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
