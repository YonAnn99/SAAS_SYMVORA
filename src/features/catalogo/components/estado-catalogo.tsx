"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { qrSvg } from "@/features/lealtad/qr";
import { cn } from "@/lib/utils";
import { mensajeErrorCatalogo } from "../catalogo-service";
import { urlCatalogo } from "../slug";
import { useBaseCatalogo } from "../use-config-catalogo";
import type { CatalogoConfig } from "../types";

/**
 * Arriba del módulo: publicar o apagar el catálogo y, publicado, compartirlo
 * (enlace, QR, copiar, abrir y WhatsApp).
 */
export function EstadoCatalogo({
  guardado,
  borrador,
  guardar,
  onFaltanDatos,
}: {
  guardado: CatalogoConfig | null;
  borrador: CatalogoConfig;
  guardar: (config: CatalogoConfig) => Promise<CatalogoConfig>;
  /** Para publicar hace falta el WhatsApp: lleva a «Personalizar». */
  onFaltanDatos: () => void;
}) {
  const locale = useLocale();
  const base = useBaseCatalogo();
  const [guardando, setGuardando] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const t = useTranslations("onlineCatalog.status");
  const te = useTranslations("onlineCatalog.errors");

  const activo = guardado?.activo ?? false;
  const enlace = activo && guardado ? urlCatalogo(guardado.slug, locale, base) : null;

  useEffect(() => {
    if (!enlace) return;
    let vigente = true;
    void qrSvg(enlace).then((s) => vigente && setSvg(s));
    return () => {
      vigente = false;
    };
  }, [enlace]);

  const cambiar = async (publicar: boolean) => {
    const actual = guardado ?? borrador;
    if (publicar && !actual.whatsapp) {
      toast.error(t("whatsappRequired"));
      onFaltanDatos();
      return;
    }
    setGuardando(true);
    try {
      await guardar({ ...actual, activo: publicar });
      toast.success(publicar ? t("published") : t("unpublished"));
    } catch (error) {
      toast.error(mensajeErrorCatalogo(error, te));
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyError"));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {activo ? t("online") : t("offline")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("desc")}
            </p>
          </div>
          <Switch
            checked={activo}
            disabled={guardando}
            onCheckedChange={(v) => void cambiar(v)}
            aria-label={t("publishAria")}
          />
        </div>

        {enlace && (
          <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center">
            <div
              className="mx-auto w-28 shrink-0 rounded-xl border border-border bg-white p-2 sm:mx-0 [&_svg]:h-auto [&_svg]:w-full"
              // SVG generado aquí con `qrcode` a partir del enlace público.
              dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{enlace}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void copiar()}>
                  <Copy className="h-3.5 w-3.5" /> {t("copy")}
                </Button>
                <a
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {t("open")}
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo y haz tu pedido: ${enlace}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Share2 className="h-3.5 w-3.5" /> {t("shareWhatsApp")}
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("shareHint")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
