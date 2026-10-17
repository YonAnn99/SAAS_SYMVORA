"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Copy, Download, Loader2, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { paletaDeTarjeta, urlAlta } from "@/features/lealtad/lealtad";
import { qrSvg } from "@/features/lealtad/qr";
import { mensajeDeError, regenerarCodigoAlta } from "@/features/lealtad/lealtad-service";
import type { ProgramaLealtad } from "@/features/lealtad/types";
import { descargarPdf } from "@/features/inventory/purchase-order-pdf";

/**
 * «QR para tu mostrador» (migracion 121): el cartel que el cliente escanea
 * para sacar su tarjeta solo. Solo aparece con el registro con QR activo.
 * «Cambiar codigo» (loyalty.manage) invalida los carteles impresos.
 */
export function QrMostrador({
  programa,
  puedeConfigurar,
  onCodigoCambiado,
}: {
  programa: ProgramaLealtad;
  puedeConfigurar: boolean;
  onCodigoCambiado: () => Promise<void> | void;
}) {
  const locale = useLocale();
  const { tenantId, tenantName, tenantLogo } = useCurrentTenant();
  const [svg, setSvg] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cambiando, setCambiando] = useState(false);

  const url = programa.codigo_alta ? urlAlta(programa.codigo_alta, locale) : null;

  useEffect(() => {
    if (!url) return;
    let vigente = true;
    void qrSvg(url).then((s) => vigente && setSvg(s));
    return () => {
      vigente = false;
    };
  }, [url]);

  if (!url) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const { generarCartelLealtad } = await import("@/features/lealtad/cartel-pdf");
      const pdf = await generarCartelLealtad({
        negocio: tenantName,
        programa: programa.nombre,
        premio: programa.premio_descripcion,
        sellosMeta: programa.sellos_meta,
        url,
        acento: paletaDeTarjeta("clara", programa.color_acento).acento,
        logoUrl: tenantLogo,
      });
      descargarPdf(pdf, `Cartel-lealtad-${tenantName.replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`);
    } catch {
      toast.error("No se pudo generar el cartel");
    } finally {
      setDescargando(false);
    }
  };

  const cambiarCodigo = async () => {
    if (!tenantId) return;
    setCambiando(true);
    try {
      await regenerarCodigoAlta(tenantId);
      await onCodigoCambiado();
      toast.success("Código cambiado. Imprime el cartel nuevo");
      setConfirmando(false);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo cambiar el código"));
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          QR para tu mostrador
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="mx-auto w-36 shrink-0 rounded-xl border border-border bg-white p-2.5 sm:mx-0 [&_svg]:h-auto [&_svg]:w-full"
          // SVG generado aqui con `qrcode` a partir de la URL del registro.
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">
            Imprime el cartel y pégalo junto a la caja. Tu cliente lo escanea con la cámara, escribe su nombre y
            celular, y su tarjeta queda lista. Si un celular ya está registrado, se le pide su tarjeta en caja.
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground" title={url}>
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 gap-1.5" onClick={descargar} disabled={descargando}>
              {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Descargar cartel (PDF)
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copiar}>
              <Copy className="h-3.5 w-3.5" />
              Copiar enlace
            </Button>
            {puedeConfigurar && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setConfirmando(true)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Cambiar código
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmando} onOpenChange={(a) => !cambiando && setConfirmando(a)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">¿Cambiar el código del QR?</DialogTitle>
            <DialogDescription className="text-sm">
              Los carteles que ya imprimiste dejarán de funcionar y tendrás que imprimir uno nuevo. Úsalo si alguien
              está abusando del registro. Las tarjetas de tus clientes no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={cambiando}>
              Cancelar
            </Button>
            <Button onClick={cambiarCodigo} disabled={cambiando} className="gap-1.5">
              {cambiando && <Loader2 className="h-4 w-4 animate-spin" />}
              Cambiar código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
