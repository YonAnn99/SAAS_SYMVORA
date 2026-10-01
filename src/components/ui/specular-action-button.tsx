"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Los botones de color del sistema (agregar, cobrar, eliminar...). Planos y con
 * los MISMOS tonos que los de la landing (`marketing/boton-capsula.ts`); al
 * pasar el raton se llenan de abajo hacia arriba con `.btn-llenado`
 * (globals.css).
 *
 * Antes llevaban un brillo WebGL recorriendo el borde y un acabado metalizado
 * (reflejo interno, sombra grande, borde tenido); se reemplazo por esto, que es
 * solo CSS. El nombre se conserva para no tocar sus ~70 usos.
 */

export type SpecularActionTone = "money" | "add" | "destructive" | "neutral";

const TONOS: Record<SpecularActionTone, string> = {
  // Agregar/crear. Como el CTA principal de la landing: negro que se llena del
  // azul SYMVORA en claro; azul que se llena de blanco en oscuro.
  add:
    "bg-primary text-white border-transparent shadow-md hover:shadow-lg " +
    "[--llenado:#1e3a8a] [--llenado-texto:#FFFFFF] dark:[--llenado:#FFFFFF] dark:[--llenado-texto:#1E3A8A]",
  // Dinero: ventas, cobros, pagos. Como "Hablar por WhatsApp" de la landing:
  // transparente con borde y se llena del verde.
  money:
    "bg-transparent text-foreground border-neutral-200 dark:border-neutral-700 hover:border-[#25D366] dark:hover:border-[#25D366] " +
    "[--llenado:#25D366] [--llenado-texto:#111111]",
  // Confirmaciones destructivas (eliminar, cancelar suscripción, etc.). La
  // landing no tiene rojo: solido para que siga llamando la atencion.
  destructive:
    "bg-[#B91C1C] text-white border-transparent shadow-md hover:shadow-lg " +
    "[--llenado:#7F1D1D] [--llenado-texto:#FFFFFF]",
  // Sin categoria de color. Como la secundaria de la landing: se invierte.
  neutral:
    "bg-white dark:bg-neutral-900 text-black dark:text-neutral-50 border-neutral-200 dark:border-neutral-800 " +
    "[--llenado:#111111] [--llenado-texto:#FFFFFF] dark:[--llenado:#FFFFFF] dark:[--llenado-texto:#111111]",
};

const TAMANOS = {
  sm: "px-[22px] py-[10px] text-[0.85rem]",
  md: "px-[30px] py-[14px] text-[1rem]",
  lg: "px-10 py-[18px] text-[1.15rem]",
} as const;

interface SpecularActionButtonProps extends ComponentProps<"button"> {
  tone?: SpecularActionTone;
  size?: keyof typeof TAMANOS;
}

export function SpecularActionButton({
  tone = "neutral",
  size = "sm",
  children,
  className,
  type = "button",
  // El resto (ref, aria-*, eventos) se reenvia: "Agregar producto" es el
  // disparador de un menu y Base UI le pasa `aria-expanded`, teclado, etc.
  ...props
}: SpecularActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "btn-llenado relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] border font-medium leading-none tracking-[0.01em]",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] active:scale-[0.97]",
        "disabled:cursor-default disabled:opacity-55 disabled:shadow-none disabled:active:scale-100",
        TONOS[tone],
        TAMANOS[size],
        className
      )}
    >
      {/* En fila y con el `gap` del boton: el SVG de un icono es `display:block`
          (preflight de Tailwind) y en un span normal bajaba de linea. */}
      <span className="relative inline-flex items-center [gap:inherit]">{children}</span>
    </button>
  );
}
