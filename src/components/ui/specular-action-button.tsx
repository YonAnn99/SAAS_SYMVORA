"use client";

import SpecularButton, {
  type SpecularButtonProps,
} from "@/components/SpecularButton";
import { cn } from "@/lib/utils";

export type SpecularActionTone = "money" | "add" | "destructive" | "neutral";

const TONE_COLORS: Record<
  SpecularActionTone,
  { tint: string; lineColor: string; baseColor: string; textColor: string }
> = {
  // Acciones relacionadas a dinero: ventas, cobros, pagos.
  money: {
    tint: "#0F3D22",
    lineColor: "#4ADE80",
    baseColor: "#15803D",
    textColor: "#F0FDF4",
  },
  // Agregar/crear registros.
  add: {
    tint: "#0D2A54",
    lineColor: "#60A5FA",
    baseColor: "#2563EB",
    textColor: "#EFF6FF",
  },
  // Confirmaciones destructivas (eliminar, cancelar suscripción, etc.)
  destructive: {
    tint: "#3F0D0D",
    lineColor: "#F87171",
    baseColor: "#B91C1C",
    textColor: "#FEF2F2",
  },
  // Botones principales sin categoría de color específica.
  neutral: {
    tint: "#0F172A",
    lineColor: "#93A5C4",
    baseColor: "#1E293B",
    textColor: "#F8FAFC",
  },
};

interface SpecularActionButtonProps
  extends Omit<
    SpecularButtonProps,
    "tint" | "tintOpacity" | "lineColor" | "baseColor" | "textColor"
  > {
  tone?: SpecularActionTone;
}

export function SpecularActionButton({
  tone = "neutral",
  size = "sm",
  className,
  autoAnimate = true,
  ...props
}: SpecularActionButtonProps) {
  const colors = TONE_COLORS[tone];

  return (
    <SpecularButton
      size={size}
      radius={10}
      tintOpacity={1}
      autoAnimate={autoAnimate}
      {...colors}
      className={cn("shrink-0 whitespace-nowrap text-sm font-medium", className)}
      {...props}
    />
  );
}
