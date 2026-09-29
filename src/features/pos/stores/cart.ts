import { create } from "zustand";
import type { CartItem } from "../types/pos.types";
import { articulosDeLinea } from "@/lib/unidades";
import type { DescuentoTicket } from "../descuento-ticket";

export type { CartItem } from "../types/pos.types";

/**
 * Identidad de una línea del carrito.
 *
 * Es producto + variante, no solo producto: dos tallas del mismo suéter son
 * dos líneas separadas, con su propio precio y su propio stock. Usar solo
 * `productId` las fusionaría y vendería la cantidad total contra una sola
 * variante.
 */
export function cartLineKey(productId: string, varianteId: string | null): string {
  return `${productId}::${varianteId ?? "general"}`;
}

interface CartStore {
  items: CartItem[];
  includeIva: boolean;
  /**
   * Descuento manual a toda la compra, como intencion ("10 %" o "$50"). Se
   * reparte entre los renglones en `usePosCart` (ver `repartirDescuento`).
   */
  descuentoTicket: DescuentoTicket | null;
  setDescuentoTicket: (descuento: DescuentoTicket | null) => void;
  addItem: (item: Omit<CartItem, "descuento"> & { descuento?: number }) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, cantidad: number) => void;
  updateDiscount: (key: string, descuento: number) => void;
  setIncludeIva: (value: boolean) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  includeIva: false,
  descuentoTicket: null,

  setDescuentoTicket: (descuento) => set({ descuentoTicket: descuento }),

  addItem: (item: Omit<CartItem, "descuento"> & { descuento?: number }) => {
    set((state) => {
      const key = cartLineKey(item.productId, item.varianteId);
      const existingItem = state.items.find(
        (i) => cartLineKey(i.productId, i.varianteId) === key
      );

      if (existingItem) {
        return {
          items: state.items.map((i) =>
            cartLineKey(i.productId, i.varianteId) === key
              ? { ...i, cantidad: i.cantidad + item.cantidad }
              : i
          ),
        };
      }

      return {
        items: [
          ...state.items,
          { ...item, descuento: item.descuento ?? 0 },
        ],
      };
    });
  },

  removeItem: (key) => {
    set((state) => {
      const items = state.items.filter(
        (i) => cartLineKey(i.productId, i.varianteId) !== key
      );
      // Al quitar el ultimo articulo se va tambien el descuento: si no, el
      // siguiente cliente heredaria el descuento del anterior sin verlo.
      return {
        items,
        descuentoTicket: items.length > 0 ? state.descuentoTicket : null,
      };
    });
  },

  updateQuantity: (key, cantidad) => {
    if (cantidad <= 0) {
      get().removeItem(key);
      return;
    }

    set((state) => ({
      items: state.items.map((i) =>
        cartLineKey(i.productId, i.varianteId) === key ? { ...i, cantidad } : i
      ),
    }));
  },

  updateDiscount: (key, descuento) => {
    set((state) => ({
      items: state.items.map((i) =>
        cartLineKey(i.productId, i.varianteId) === key ? { ...i, descuento } : i
      ),
    }));
  },

  clearCart: () => set({ items: [], includeIva: false, descuentoTicket: null }),

  setIncludeIva: (value) => set({ includeIva: value }),

  getSubtotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0
    );
  },

  getDiscount: () => {
    return get().items.reduce((sum, item) => sum + item.descuento, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscount();
    return subtotal - discount;
  },

  getItemCount: () => {
    // Por medida cuenta 1 (ver `articulosDeLinea`): si no, "3.75 articulos".
    return get().items.reduce((sum, item) => sum + articulosDeLinea(item.cantidad, item.unidad_medida), 0);
  },
}));
