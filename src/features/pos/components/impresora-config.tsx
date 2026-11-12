"use client";

/**
 * Configuracion -> Impresora: la impresora de tickets de ESTE equipo.
 * Conectarla (Bluetooth, USB o puerto serie, solo las que el navegador
 * soporta), el ancho del papel, si imprime sola al cobrar y una hoja de
 * prueba. Incluye la guia para Windows + USB y el aviso para iPhone, donde el
 * navegador no deja imprimir directo.
 *
 * Antes vivia en un boton de la barra del POS; se movio aqui para
 * despejarla.
 */

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Bluetooth, Cable, Loader2, Printer, Usb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import type { TipoConexion } from "../impresora/conexiones";
import { imprimirPrueba } from "../impresora/imprimir-ticket";
import {
  ajustarImpresora,
  conectarImpresora,
  olvidarImpresora,
  useImpresora,
} from "../impresora/use-impresora";

/** Textos: `settings.printerConfig.types.<tipo>.label/help`. */
const OPCIONES: Record<TipoConexion, { icono: typeof Bluetooth }> = {
  bluetooth: { icono: Bluetooth },
  usb: { icono: Usb },
  serie: { icono: Cable },
};

export function ImpresoraConfig() {
  const t = useTranslations("settings.printerConfig");
  const { tenantName } = useCurrentTenant();
  const { config, estado, mensaje, soportadas } = useImpresora();
  const [probando, setProbando] = useState(false);

  const conectar = async (tipo: TipoConexion) => {
    try {
      await conectarImpresora(tipo);
      toast.success(t("connected"));
    } catch {
      toast.error(t("connectError"));
    }
  };

  const prueba = async () => {
    if (!config) return;
    setProbando(true);
    try {
      await imprimirPrueba(config, tenantName ?? "SYMVORA");
      toast.success(t("testSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("printError"));
    } finally {
      setProbando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Printer className="h-4 w-4" /> {t("title")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t.rich("desc", { b: (chunks) => <strong>{chunks}</strong> })}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-md">
        <div className="space-y-4 text-sm">
          {config && (
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="font-medium">{config.nombre ?? t("fallbackName")}</p>
              <p
                className={`text-xs ${
                  estado === "lista"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : estado === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {t(`states.${estado}`)}
                {mensaje ? ` · ${mensaje}` : ""}
              </p>
            </div>
          )}

          {soportadas.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {config ? t("connectAnother") : t("connectVia")}
              </p>
              {soportadas.map((tipo) => {
                const { icono: Icono } = OPCIONES[tipo];
                return (
                  <Button
                    key={tipo}
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 py-2 text-left"
                    disabled={estado === "conectando"}
                    onClick={() => void conectar(tipo)}
                  >
                    {estado === "conectando" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Icono className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex flex-col">
                      <span className="text-sm">{t(`types.${tipo}.label`)}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{t(`types.${tipo}.help`)}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("unsupported")}
            </p>
          )}

          {config && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("paperWidth")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([58, 80] as const).map((ancho) => (
                    <Button
                      key={ancho}
                      variant={config.ancho === ancho ? "default" : "outline"}
                      size="sm"
                      className="h-9"
                      onClick={() => ajustarImpresora({ ancho })}
                    >
                      {ancho} mm
                    </Button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block">{t("autoPrint")}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {t("autoPrintHint")}
                  </span>
                </span>
                <Switch
                  checked={config.auto}
                  onCheckedChange={(auto) => ajustarImpresora({ auto })}
                />
              </label>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1"
                  disabled={probando}
                  onClick={() => void prueba()}
                >
                  {probando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {t("testPrint")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => void olvidarImpresora()}
                >
                  {t("remove")}
                </Button>
              </div>
            </>
          )}

          <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              {t("windowsTitle")}
            </summary>
            <p className="mt-2">
              {t("windowsIntro")}
            </p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>{t.rich("windowsStep1", { b: (chunks) => <strong>{chunks}</strong> })}</li>
              <li>
                {t("windowsStep2")}{" "}
                <code className="rounded bg-muted px-1">--kiosk-printing</code>.
              </li>
              <li>{t("windowsStep3")}</li>
            </ol>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
