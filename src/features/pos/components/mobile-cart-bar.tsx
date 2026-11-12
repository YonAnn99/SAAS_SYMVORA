"use client";

import { useMoneda } from "@/hooks/use-moneda";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVuelosAlCarrito } from "../vuelo-al-carrito";

interface MobileCartBarProps {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

/**
 * La barra del carrito en celular y tablet: la acción principal del POS. Con
 * artículos va en azul, con el conteo y el total; vacía se queda tranquila y
 * explica qué hacer (rediseño del 2026-10-06).
 *
 * Es el destino del vuelo al carrito (`vuelo-al-carrito.ts`): mientras un
 * producto va en el aire, la barra conserva el conteo y el total que tenía y
 * los pone al día cuando aterriza (~0.4 s). El carrito ya cambió: solo el
 * número espera.
 */
export function MobileCartBar({ itemCount, total, onOpen }: MobileCartBarProps) {
  const { formatear } = useMoneda();
  const t = useTranslations("pos.cartBar");
  const { activos, aterrizajes } = useVuelosAlCarrito();
  const [mostrado, setMostrado] = useState({ itemCount, total, aterrizajes });
  const desactualizado =
    mostrado.itemCount !== itemCount ||
    mostrado.total !== total ||
    mostrado.aterrizajes !== aterrizajes;
  // Se ajusta durante el render (patrón de React para derivar de props), no en
  // un efecto: sin vuelos, el número va al día en el mismo cuadro.
  if (desactualizado && (activos === 0 || mostrado.aterrizajes !== aterrizajes)) {
    setMostrado({ itemCount, total, aterrizajes });
  }

  const conArticulos = mostrado.itemCount > 0;

  return (
    <button
      type="button"
      data-barra-carrito
      onClick={onOpen}
      aria-label={
        itemCount > 0
          ? t("ariaWithItems", { count: itemCount, total: formatear(total) })
          : t("ariaEmpty")
      }
      className={cn(
        "lg:hidden flex h-14 shrink-0 items-center gap-3 rounded-2xl text-left transition-transform active:scale-[0.99]",
        conArticulos
          ? "bg-primary pl-2.5 pr-4 text-primary-foreground shadow-lg shadow-primary/30"
          : "border border-border bg-card px-4 text-muted-foreground"
      )}
    >
      {conArticulos ? (
        <>
          <span
            data-destino-carrito
            className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-white/20 px-2 text-base font-bold"
          >
            {mostrado.itemCount}
          </span>
          <span className="flex-1 text-base font-semibold">{t("viewCart")}</span>
          <span className="font-mono text-[17px] font-bold">{formatear(mostrado.total)}</span>
          <ChevronUp className="h-5 w-5" aria-hidden="true" />
        </>
      ) : (
        <>
          <span data-destino-carrito className="flex shrink-0">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1 text-[15px]">{t("empty")}</span>
          <span className="hidden text-xs min-[380px]:inline">{t("tapToAdd")}</span>
        </>
      )}
    </button>
  );
}
