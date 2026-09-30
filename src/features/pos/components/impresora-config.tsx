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

const OPCIONES: Record<TipoConexion, { etiqueta: string; ayuda: string; icono: typeof Bluetooth }> = {
  bluetooth: { etiqueta: "Bluetooth", ayuda: "Impresoras portátiles y la mayoría de las inalámbricas", icono: Bluetooth },
  usb: { etiqueta: "USB (cable)", ayuda: "Celular/tablet Android, Mac o Linux", icono: Usb },
  serie: { etiqueta: "Puerto serie", ayuda: "Bluetooth ya emparejado en la PC o USB-serie", icono: Cable },
};

const TEXTO_ESTADO = {
  "sin-configurar": "Sin impresora",
  desconectada: "Guardada, sin conexión",
  conectando: "Conectando…",
  lista: "Lista para imprimir",
  error: "No responde",
} as const;

export function ImpresoraConfig() {
  const { tenantName } = useCurrentTenant();
  const { config, estado, mensaje, soportadas } = useImpresora();
  const [probando, setProbando] = useState(false);

  const conectar = async (tipo: TipoConexion) => {
    try {
      await conectarImpresora(tipo);
      toast.success("Impresora conectada");
    } catch {
      toast.error("No se pudo conectar la impresora");
    }
  };

  const prueba = async () => {
    if (!config) return;
    setProbando(true);
    try {
      await imprimirPrueba(config, tenantName ?? "SYMVORA");
      toast.success("Hoja de prueba enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo imprimir");
    } finally {
      setProbando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Printer className="h-4 w-4" /> Impresora de tickets
        </CardTitle>
        <CardDescription className="text-xs">
          Con la impresora conectada, el ticket sale directo al cobrar, sin la ventana de
          impresión. Se guarda en <strong>este equipo</strong>: para la caja de un cajero,
          inicia sesión una vez en ese equipo y conéctala aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-md">
        <div className="space-y-4 text-sm">
          {config && (
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="font-medium">{config.nombre ?? "Impresora"}</p>
              <p
                className={`text-xs ${
                  estado === "lista"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : estado === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {TEXTO_ESTADO[estado]}
                {mensaje ? ` · ${mensaje}` : ""}
              </p>
            </div>
          )}

          {soportadas.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {config ? "Conectar otra o reconectar" : "Conectar por"}
              </p>
              {soportadas.map((tipo) => {
                const { etiqueta, ayuda, icono: Icono } = OPCIONES[tipo];
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
                      <span className="text-sm">{etiqueta}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{ayuda}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Este navegador no permite conectar impresoras directamente (pasa en iPhone y
              iPad, y en Firefox). El ticket se imprimirá con la ventana de impresión normal.
              En Android o PC usa Chrome o Edge.
            </p>
          )}

          {config && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Ancho del papel</p>
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
                  <span className="block">Imprimir al cobrar</span>
                  <span className="block text-[11px] text-muted-foreground">
                    El ticket sale solo al completar la venta
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
                  Imprimir prueba
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground"
                  onClick={() => void olvidarImpresora()}
                >
                  Quitar
                </Button>
              </div>
            </>
          )}

          <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              ¿Impresora USB en una PC con Windows?
            </summary>
            <p className="mt-2">
              En Windows el driver de la impresora no deja que el navegador le hable directo.
              Para que imprima sin la ventana:
            </p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Pon la impresora de tickets como <strong>predeterminada</strong> en Windows.</li>
              <li>
                Crea un acceso directo de Chrome y, en Propiedades → Destino, agrega al final{" "}
                <code className="rounded bg-muted px-1">--kiosk-printing</code>.
              </li>
              <li>Abre SYMVORA desde ese acceso directo: los tickets saldrán directo.</li>
            </ol>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
