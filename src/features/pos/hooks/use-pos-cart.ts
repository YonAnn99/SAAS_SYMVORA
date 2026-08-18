"use client";

import { useCartStore } from "../stores/cart";
import { calculateSaleTotals } from "../services/pos-service";
import type { SaleTotals } from "../types/pos.types";

export interface PosCartState {
  items: ReturnType<typeof useCartStore.getState>["items"];
  totals: SaleTotals;
  itemCount: number;
  addItem: ReturnType<typeof useCartStore.getState>["addItem"];
  removeItem: ReturnType<typeof useCartStore.getState>["removeItem"];
  updateQuantity: ReturnType<typeof useCartStore.getState>["updateQuantity"];
  clearCart: ReturnType<typeof useCartStore.getState>["clearCart"];
}

export function usePosCart(): PosCartState {
  const store = useCartStore();
  const items = store.items;
  const totals = calculateSaleTotals(items);
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    items,
    totals,
    itemCount,
    addItem: store.addItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    clearCart: store.clearCart,
  };
}