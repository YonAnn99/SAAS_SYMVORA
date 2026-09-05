"use client";

import { ChevronUp, ShoppingCart } from "lucide-react";

interface MobileCartBarProps {
  itemCount: number;
  total: number;
  onOpen: () => void;
}

export function MobileCartBar({ itemCount, total, onOpen }: MobileCartBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="lg:hidden flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium active:scale-[0.99] transition-transform"
    >
      <span className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        {itemCount > 0
          ? `${itemCount} artículo${itemCount === 1 ? "" : "s"}`
          : "Carrito vacío"}
      </span>
      <span className="flex items-center gap-1 font-mono">
        ${total.toFixed(2)}
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </span>
    </button>
  );
}
