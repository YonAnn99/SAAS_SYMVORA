"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useCartStore } from "../stores/cart";
import { calculateSaleTotals } from "../services/pos-service";
import { repartirDescuento, type DescuentoTicket } from "../descuento-ticket";
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
  descuentoTicket: DescuentoTicket | null;
  setDescuentoTicket: ReturnType<typeof useCartStore.getState>["setDescuentoTicket"];
  clearCart: ReturnType<typeof useCartStore.getState>["clearCart"];
  /**
   * Ya se restauro el carrito guardado de la pestaña (y se comprobo su dueño).
   * Antes de eso no se agrega nada: la restauracion lo reemplazaria.
   */
  restaurado: boolean;
}

const suscribirHidratacion = (aviso: () => void) =>
  useCartStore.persist.onFinishHydration(aviso);
const estaHidratado = () => useCartStore.persist.hasHydrated();
// El servidor no ve sessionStorage: para el, nunca esta restaurado.
const hidratadoEnServidor = () => false;

export function usePosCart(tenantId: string | null, userId: string | null): PosCartState {
  const store = useCartStore();
  const hidratado = useSyncExternalStore(suscribirHidratacion, estaHidratado, hidratadoEnServidor);
  const duenio = tenantId && userId ? `${userId}:${tenantId}` : null;

  // El carrito guardado (sessionStorage) se lee aqui y no al crear el store:
  // el primer render tiene que coincidir con el del servidor, que no lo ve.
  // Al volver al POS sin recargar, memoria y sessionStorage ya coinciden:
  // restaurar de nuevo no cambia nada.
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  // Un carrito guardado por otro usuario u otro negocio no se hereda. Sin
  // usuario o negocio todavia (cargando), no se toca.
  useEffect(() => {
    if (!hidratado || !duenio) return;
    const actual = useCartStore.getState();
    if (actual.duenio !== duenio) {
      actual.clearCart();
      actual.setDuenio(duenio);
    }
  }, [hidratado, duenio]);

  // El descuento del ticket se reparte AQUI, una sola vez: todo lo que recibe
  // `items` (totales, cobro, terminal, ticket) ve ya los renglones con su parte.
  const items = repartirDescuento(store.items, store.descuentoTicket);
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
    descuentoTicket: store.descuentoTicket,
    setDescuentoTicket: store.setDescuentoTicket,
    clearCart: store.clearCart,
    restaurado: hidratado && duenio !== null && store.duenio === duenio,
  };
}
