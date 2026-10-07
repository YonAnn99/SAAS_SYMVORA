import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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

/** Llave en sessionStorage del carrito en curso. */
export const CLAVE_CARRITO = "symvora-carrito";

interface CartStore {
  items: CartItem[];
  /**
   * De quien es el carrito guardado: `"<userId>:<tenantId>"`. Si entra otro
   * usuario u otro negocio en la misma pestaña, `usePosCart` lo vacia.
   */
  duenio: string | null;
  setDuenio: (duenio: string) => void;
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

/**
 * El carrito se guarda en sessionStorage (2026-10-06): si la pagina se recarga
 * (p. ej. deslizando hacia abajo en el celular), la venta en curso sigue ahi y
 * lo que se ve es lo que hay. Solo en esa pestaña; se vacia al cobrar, al
 * cerrar sesion (`vaciarCarritoGuardado`) o si cambia el dueño.
 *
 * `skipHydration`: el servidor no tiene sessionStorage y el primer render debe
 * coincidir con el suyo. `usePosCart` lo restaura al montar.
 */
export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
  items: [],
  duenio: null,
  includeIva: false,
  descuentoTicket: null,

  setDuenio: (duenio) => set({ duenio }),

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
    }),
    {
      name: CLAVE_CARRITO,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        duenio: state.duenio,
        includeIva: state.includeIva,
        descuentoTicket: state.descuentoTicket,
      }),
    }
  )
);

/** Al cerrar sesion: no debe quedar la venta del usuario anterior en la pestaña. */
export function vaciarCarritoGuardado(): void {
  useCartStore.getState().clearCart();
  useCartStore.getState().setDuenio("");
  useCartStore.persist.clearStorage();
}
