"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
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
      toast.error("Escribe el WhatsApp que recibirá los pedidos");
      onFaltanDatos();
      return;
    }
    setGuardando(true);
    try {
      await guardar({ ...actual, activo: publicar });
      toast.success(publicar ? "¡Tu catálogo ya está en línea!" : "Catálogo apagado: el enlace ya no muestra productos");
    } catch (error) {
      toast.error(mensajeErrorCatalogo(error));
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {activo ? "Tu catálogo está en línea" : "Tu catálogo está apagado"}
            </p>
            <p className="text-xs text-muted-foreground">
              Tus clientes ven tus productos, arman su pedido y te lo mandan por WhatsApp. No cobra en línea ni
              descuenta inventario: tú confirmas y cobras como siempre.
            </p>
          </div>
          <Switch
            checked={activo}
            disabled={guardando}
            onCheckedChange={(v) => void cambiar(v)}
            aria-label="Publicar catálogo en línea"
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
                  <Copy className="h-3.5 w-3.5" /> Copiar enlace
                </Button>
                <a
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir catálogo
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo y haz tu pedido: ${enlace}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Share2 className="h-3.5 w-3.5" /> Compartir por WhatsApp
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Ponlo en tu estado de WhatsApp, en Facebook o imprime el QR para tu mostrador.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
