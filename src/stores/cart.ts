import { create } from "zustand";

export interface CartItem {
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  unidad_medida: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "SERVICIO";
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "descuento"> & { descuento?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, cantidad: number) => void;
  updateDiscount: (productId: string, descuento: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item: Omit<CartItem, "descuento"> & { descuento?: number }) => {
    set((state) => {
      const existingItem = state.items.find(
        (i) => i.productId === item.productId
      );

      if (existingItem) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
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

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
  },

  updateQuantity: (productId, cantidad) => {
    if (cantidad <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, cantidad } : i
      ),
    }));
  },

  updateDiscount: (productId, descuento) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, descuento } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

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
    return get().items.reduce((sum, item) => sum + item.cantidad, 0);
  },
}));
