"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("customers.loyalty.counterQr");
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
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyError"));
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
      toast.error(t("posterError"));
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
      toast.success(t("codeChanged"));
      setConfirmando(false);
    } catch (error) {
      toast.error(mensajeDeError(error, t("codeChangeError")));
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          {t("title")}
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
            {t("desc")}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground" title={url}>
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 gap-1.5" onClick={descargar} disabled={descargando}>
              {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {t("download")}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copiar}>
              <Copy className="h-3.5 w-3.5" />
              {t("copy")}
            </Button>
            {puedeConfigurar && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setConfirmando(true)}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t("changeCode")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmando} onOpenChange={(a) => !cambiando && setConfirmando(a)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t("confirmTitle")}</DialogTitle>
            <DialogDescription className="text-sm">
              {t("confirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={cambiando}>
              {t("cancel")}
            </Button>
            <Button onClick={cambiarCodigo} disabled={cambiando} className="gap-1.5">
              {cambiando && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("changeCode")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
