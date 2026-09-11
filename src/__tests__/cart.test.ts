import { describe, it, expect, beforeEach } from "vitest";
import { cartLineKey, useCartStore } from "@/features/pos/stores/cart";

describe("Cart Store", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  const mockItem = {
    productId: "test-product-1",
    varianteId: null,
    nombre: "Coca Cola 600ml",
    cantidad: 2,
    precioUnitario: 18.5,
    unidad_medida: "PIEZA" as const,
  };

  const mockItem2 = {
    productId: "test-product-2",
    varianteId: null,
    nombre: "Sabritas Original",
    cantidad: 1,
    precioUnitario: 22.0,
    unidad_medida: "PIEZA" as const,
  };

  it("should start with empty cart", () => {
    const { items, getItemCount } = useCartStore.getState();
    expect(items).toEqual([]);
    expect(getItemCount()).toBe(0);
  });

  it("should add an item to the cart", () => {
    const { addItem, items, getItemCount } = useCartStore.getState();
    addItem(mockItem);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe("test-product-1");
    expect(state.items[0].cantidad).toBe(2);
    expect(getItemCount()).toBe(2);
  });

  it("should increase quantity when adding same product", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);
    addItem({ ...mockItem, cantidad: 1 });

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].cantidad).toBe(3);
    expect(state.getItemCount()).toBe(3);
  });

  it("should add multiple different products", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);
    addItem(mockItem2);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.getItemCount()).toBe(3);
  });

  it("should remove an item from the cart", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);
    addItem(mockItem2);

    useCartStore.getState().removeItem(cartLineKey("test-product-1", null));

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe("test-product-2");
  });

  it("should update quantity", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);

    useCartStore.getState().updateQuantity(cartLineKey("test-product-1", null), 5);

    const state = useCartStore.getState();
    expect(state.items[0].cantidad).toBe(5);
    expect(state.getItemCount()).toBe(5);
  });

  it("should remove item when quantity is 0 or less", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);

    useCartStore.getState().updateQuantity(cartLineKey("test-product-1", null), 0);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
  });

  it("should calculate subtotal correctly", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem); // 2 x 18.50 = 37.00
    addItem(mockItem2); // 1 x 22.00 = 22.00

    const { getSubtotal } = useCartStore.getState();
    expect(getSubtotal()).toBe(59.0);
  });

  it("should calculate discount correctly", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);
    addItem(mockItem2);

    useCartStore.getState().updateDiscount(cartLineKey("test-product-1", null), 5.0);

    const { getDiscount } = useCartStore.getState();
    expect(getDiscount()).toBe(5.0);
  });

  it("should calculate total as subtotal minus discount", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem); // 37.00
    addItem(mockItem2); // 22.00

    useCartStore.getState().updateDiscount(cartLineKey("test-product-1", null), 7.0);

    const { getTotal } = useCartStore.getState();
    expect(getTotal()).toBe(52.0); // 59.0 - 7.0
  });

  it("should clear the cart", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);
    addItem(mockItem2);

    useCartStore.getState().clearCart();

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.getItemCount()).toBe(0);
    expect(state.getSubtotal()).toBe(0);
  });

  it("should default discount to 0", () => {
    const { addItem } = useCartStore.getState();
    addItem(mockItem);

    const state = useCartStore.getState();
    expect(state.items[0].descuento).toBe(0);
  });

  describe("variantes", () => {
    const sueter = {
      productId: "sueter",
      nombre: "Sueter",
      cantidad: 1,
      precioUnitario: 80,
      unidad_medida: "PIEZA" as const,
    };

    it("dos variantes del mismo producto son DOS líneas distintas", () => {
      // Es lo esencial del modelo: cada talla tiene su propio precio y su
      // propio stock. Fusionarlas vendería la cantidad total contra una sola.
      const { addItem } = useCartStore.getState();
      addItem({ ...sueter, varianteId: "m-rojo", varianteLabel: "M · ROJO" });
      addItem({ ...sueter, varianteId: "g-azul", varianteLabel: "G · AZUL" });

      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it("la misma variante sí acumula cantidad", () => {
      const { addItem } = useCartStore.getState();
      addItem({ ...sueter, varianteId: "m-rojo" });
      addItem({ ...sueter, varianteId: "m-rojo" });

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].cantidad).toBe(2);
    });

    it("la venta general y una variante del mismo producto no se fusionan", () => {
      const { addItem } = useCartStore.getState();
      addItem({ ...sueter, varianteId: null });
      addItem({ ...sueter, varianteId: "m-rojo" });

      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it("quitar una variante no afecta a la otra", () => {
      const { addItem } = useCartStore.getState();
      addItem({ ...sueter, varianteId: "m-rojo" });
      addItem({ ...sueter, varianteId: "g-azul" });

      useCartStore.getState().removeItem(cartLineKey("sueter", "m-rojo"));

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].varianteId).toBe("g-azul");
    });
  });
});
