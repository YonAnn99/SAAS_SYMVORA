"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTACT_EMAIL } from "@/lib/contact";
import {
  CONJUNTOS,
  DIAS_GRACIA_EXPORTACION,
  descargarConjunto,
  limiteDescarga,
} from "../exportacion-datos";

interface DescargaDatosCuentaProps {
  tenantId: string;
  subscription: { current_period_end: string | null; trial_end: string | null };
}

/**
 * "Descarga tu informacion" en /billing para cuentas vencidas o canceladas:
 * cumple el periodo de gracia de la seccion 6 de los Terminos.
 */
export function DescargaDatosCuenta({ tenantId, subscription }: DescargaDatosCuentaProps) {
  const [descargando, setDescargando] = useState<string | null>(null);
  const limite = limiteDescarga(subscription);

  const descargar = async (clave: string) => {
    const conjunto = CONJUNTOS.find((c) => c.clave === clave);
    if (!conjunto) return;
    setDescargando(clave);
    try {
      const total = await descargarConjunto(conjunto, tenantId);
      toast.success(`${conjunto.etiqueta}: ${total} registros descargados`);
    } catch (error) {
      console.error("Error al exportar", clave, error);
      toast.error(`No se pudo descargar ${conjunto.etiqueta.toLowerCase()}`);
    } finally {
      setDescargando(null);
    }
  };

  return (
    <Card className="animate-fade-in-up stagger-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Download className="h-4 w-4" />
          Descarga tu información
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tu información sigue siendo tuya. Tienes {DIAS_GRACIA_EXPORTACION} días
          naturales desde que terminó tu acceso para descargarla
          {limite
            ? ` (hasta el ${limite.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })})`
            : ""}
          . Cada archivo es un CSV que abre en Excel.
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
              {c.etiqueta}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          ¿Necesitas otro formato o algo que no está aquí? Escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
