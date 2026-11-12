"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTACT_EMAIL } from "@/lib/contact";
import { DIAS_CONSERVACION_DATOS } from "@/lib/acceso-suscripcion";
import { CONJUNTOS, descargarConjunto } from "../exportacion-datos";

interface DescargaDatosCuentaProps {
  tenantId: string;
  /** Fin del periodo para descargar (`limiteConservacion`). */
  limite: Date | null;
}

/**
 * "Descarga tu informacion" en /billing para cuentas vencidas o canceladas:
 * cumple el periodo de gracia de la seccion 6 de los Terminos.
 */
export function DescargaDatosCuenta({ tenantId, limite }: DescargaDatosCuentaProps) {
  const [descargando, setDescargando] = useState<string | null>(null);
  const t = useTranslations("billing.dataDownload");
  const li = localeIntl(useLocale());
  const etiqueta = (clave: string) => t(`sets.${clave}`);

  const descargar = async (clave: string) => {
    const conjunto = CONJUNTOS.find((c) => c.clave === clave);
    if (!conjunto) return;
    setDescargando(clave);
    try {
      const total = await descargarConjunto(conjunto, tenantId);
      toast.success(t("downloaded", { conjunto: etiqueta(conjunto.clave), total }));
    } catch (error) {
      console.error("Error al exportar", clave, error);
      toast.error(t("error", { conjunto: etiqueta(conjunto.clave).toLowerCase() }));
    } finally {
      setDescargando(null);
    }
  };

  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("desc", { dias: DIAS_CONSERVACION_DATOS })}
          {limite
            ? ` ${t("until", {
                fecha: limite.toLocaleDateString(li, { day: "numeric", month: "long", year: "numeric" }),
              })}`
            : ""}
          . {t("csv")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONJUNTOS.map((c) => (
            <Button
              key={c.clave}
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              disabled={descargando !== null}
              onClick={() => void descargar(c.clave)}
            >
              {descargando === c.clave ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {etiqueta(c.clave)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("otherFormat")}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
