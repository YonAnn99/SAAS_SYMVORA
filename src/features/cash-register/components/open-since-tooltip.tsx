"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localeIntl } from "@/lib/idioma";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { duracionAbierta, formatearApertura } from "../open-since";

interface OpenSinceTooltipProps {
  /** `fecha_apertura` de la caja activa. Sin ella no se muestra nada. */
  fechaApertura: string | null | undefined;
  children: ReactNode;
}

/**
 * Ventanita que sigue al cursor con la apertura de la caja.
 *
 * SIGUE AL CURSOR SIN CÓDIGO PROPIO: Base UI lo hace de serie con
 * `trackCursorAxis` en `Tooltip.Root`. No hace falta escuchar `mousemove` ni
 * calcular posiciones a mano.
 *
 * Solo envuelve el bloque del título de Finanzas, que es el área pedida: el
 * resto de la pantalla no debe dispararla.
 */
export function OpenSinceTooltip({
  fechaApertura,
  children,
}: OpenSinceTooltipProps) {
  const t = useTranslations("finances.openSince");
  const locale = useLocale();
  // Sin caja abierta no hay apertura que previsualizar, y la pantalla ya
  // muestra el botón "Abrir caja" bien visible. Se devuelve el contenido tal
  // cual para no alterar el layout.
  if (!fechaApertura) {
    return <div>{children}</div>;
  }

  const duracion = duracionAbierta(fechaApertura);
  const transcurrido = !duracion
    ? ""
    : duracion.tipo === "momento"
      ? t("moment")
      : duracion.tipo === "minutos"
        ? t("minutes", { count: duracion.n })
        : duracion.tipo === "horas"
          ? duracion.min > 0
            ? t("hoursMinutes", { count: duracion.n, min: duracion.min })
            : t("hours", { count: duracion.n })
          : t("days", { count: duracion.n });

  return (
    <Tooltip trackCursorAxis="both">
      {/*
        `render` es OBLIGATORIO aquí: `TooltipTrigger` renderiza un <button> por
        defecto (`useRenderElement('button', …)`), y meter el <h2> dentro de un
        botón rompe la semántica del encabezado, lo hace enfocable y le aplica
        el reset de botón. Con `render` sale un <div> normal.
      */}
      <TooltipTrigger render={<div className="cursor-help" />}>
        {children}
      </TooltipTrigger>

      {/*
        Sin flecha: apunta a un punto que se mueve con el cursor y se ve mal.
        Se anula aquí y no en el componente compartido, que lo necesita para
        sus futuros usos anclados.
      */}
      <TooltipContent
        className="flex-col items-start gap-0.5 [&_[data-side]]:hidden"
        sideOffset={16}
      >
        <span className="font-medium">
          {t("openedOn", { fecha: formatearApertura(fechaApertura, localeIntl(locale), t("noDate")) })}
        </span>
        {transcurrido && (
          <span className="opacity-70">{transcurrido}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
