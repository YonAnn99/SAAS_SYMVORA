"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "../stores/cart";
import { calculateSaleTotals } from "../services/pos-service";
import type { SaleTotals } from "../types/pos.types";

export interface PosCartState {
  items: ReturnType<typeof useCartStore.getState>["items"];
  totals: SaleTotals;
  itemCount: number;
  includeIva: boolean;
  addItem: ReturnType<typeof useCartStore.getState>["addItem"];
  removeItem: ReturnType<typeof useCartStore.getState>["removeItem"];
  updateQuantity: ReturnType<typeof useCartStore.getState>["updateQuantity"];
  setIncludeIva: ReturnType<typeof useCartStore.getState>["setIncludeIva"];
  clearCart: ReturnType<typeof useCartStore.getState>["clearCart"];
}

export function usePosCart(tenantId: string | null): PosCartState {
  const store = useCartStore();
  const previousTenantId = useRef(tenantId);

  useEffect(() => {
    if (previousTenantId.current !== tenantId) {
      store.clearCart();
      previousTenantId.current = tenantId;
    }
  }, [tenantId, store]);

  const items = store.items;
  const totals = calculateSaleTotals(items, store.includeIva);
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    items,
    totals,
    itemCount,
    includeIva: store.includeIva,
    addItem: store.addItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    setIncludeIva: store.setIncludeIva,
    clearCart: store.clearCart,
  };
}