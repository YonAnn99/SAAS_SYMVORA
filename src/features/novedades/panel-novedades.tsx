"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Megaphone } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { useEsMovil } from "@/hooks/use-es-movil";
import type { Novedad } from "@/lib/novedades";
import { EtiquetaNuevo } from "./etiqueta-nuevo";
import { useNovedades } from "./use-novedades";

/**
 * Panel «Novedades» (estilo Kyte): las novedades que esta persona puede ver, con su imagen, etiquetas y
 * un detalle al tocar. Sale de `lib/novedades.ts`, la misma fuente que la ventana y la campana.
 *
 * «Conocerlo» lleva al módulo y marca la novedad como vista (quita su «Nuevo»). Abrir el panel no marca nada.
 */
export function PanelNovedades() {
  const t = useTranslations("news");
  const { tenantName } = useCurrentTenant();
  // En celular el panel baja desde arriba, como un modal; en escritorio sale por la derecha.
  const esMovil = useEsMovil();
  const { activas, estado, marcarVista } = useNovedades();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Novedad | null>(null);

  // Sin novedades vigentes para esta persona, no hay botón.
  if (activas.length === 0) return null;

  const vista = (n: Novedad) => estado.vistas.includes(n.id);
  const hayNuevas = activas.some((n) => !vista(n));
  // Texto en el idioma de la interfaz; si falta la clave, el de `NOVEDADES`.
  const texto = (n: Novedad, campo: string, respaldo: string) =>
    t.has(`${n.id}.${campo}`) ? t(`${n.id}.${campo}`) : respaldo;
  const etiquetaTipo = (n: Novedad) => (n.tipo === "funcion" ? t("kind.feature") : t("kind.improvement"));

  const cambiar = (v: boolean) => {
    setAbierto(v);
    if (!v) setDetalle(null);
  };

  const conocer = (n: Novedad) => {
    marcarVista(n.id);
    cambiar(false);
    router.push(n.href);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60"
        aria-label={t("panel.open")}
        title={t("panel.open")}
        onClick={() => setAbierto(true)}
      >
        <Megaphone className="h-4 w-4" aria-hidden="true" />
        {hayNuevas && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />
        )}
      </Button>

      <Sheet open={abierto} onOpenChange={cambiar}>
        <SheetContent
          side={esMovil ? "top" : "right"}
          className={
            esMovil
              ? "max-h-[90dvh] overflow-y-auto rounded-b-2xl pt-[max(1rem,env(safe-area-inset-top))]"
              : "w-full overflow-y-auto sm:max-w-md"
          }
        >
          {detalle ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => setDetalle(null)}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("panel.back")}
              </Button>
              {(detalle.detalle ?? detalle.portada) && (
                <Image
                  src={(detalle.detalle ?? detalle.portada) as string}
                  alt=""
                  width={1280}
                  height={720}
                  sizes="(min-width: 640px) 448px, 100vw"
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
              <SheetHeader className="p-0">
                <SheetTitle className="text-lg leading-tight">{texto(detalle, "title", detalle.titulo)}</SheetTitle>
                <SheetDescription>{texto(detalle, "text", detalle.texto)}</SheetDescription>
              </SheetHeader>
              <ul className="space-y-2">
                {detalle.puntos.map((p, i) => (
                  <li key={p} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>{texto(detalle, `points.${i}`, p)}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => conocer(detalle)}>
                {texto(detalle, "button", detalle.boton)}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <SheetHeader className="p-0">
                <SheetTitle>{t("panel.title")}</SheetTitle>
                <SheetDescription>{t("panel.greeting", { nombre: tenantName ?? "" })}</SheetDescription>
              </SheetHeader>
              <div className="space-y-3">
                {activas.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setDetalle(n)}
                    className="w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:bg-muted/40"
                  >
                    {n.portada && (
                      <Image
                        src={n.portada}
                        alt=""
                        width={960}
                        height={544}
                        sizes="(min-width: 640px) 448px, 100vw"
                        className="aspect-video w-full object-cover"
                      />
                    )}
                    <div className="space-y-1.5 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!vista(n) && <EtiquetaNuevo />}
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {etiquetaTipo(n)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-snug">{texto(n, "title", n.titulo)}</p>
                      <p className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                        <span>{texto(n, "text", n.texto)}</span>
                        <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
