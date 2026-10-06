"use client";

import { ChevronUp, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileCartBarProps {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

/**
 * La barra del carrito en celular y tablet: la acción principal del POS. Con
 * artículos va en azul, con el conteo y el total; vacía se queda tranquila y
 * explica qué hacer (rediseño del 2026-10-06).
 */
export function MobileCartBar({ itemCount, total, onOpen }: MobileCartBarProps) {
  const conArticulos = itemCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        conArticulos
          ? `Ver carrito: ${itemCount} artículo${itemCount === 1 ? "" : "s"}, total $${total.toFixed(2)}`
          : "Ver carrito vacío"
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
          <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-white/20 px-2 text-base font-bold">
            {itemCount}
          </span>
          <span className="flex-1 text-base font-semibold">Ver carrito</span>
          <span className="font-mono text-[17px] font-bold">${total.toFixed(2)}</span>
          <ChevronUp className="h-5 w-5" aria-hidden="true" />
        </>
      ) : (
        <>
          <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-[15px]">El carrito está vacío</span>
          <span className="hidden text-xs min-[380px]:inline">Toca un producto para agregarlo</span>
        </>
      )}
    </button>
  );
}
