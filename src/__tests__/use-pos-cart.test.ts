import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { useCartStore } from "@/features/pos/stores/cart";

describe("usePosCart tenant scoping", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  const mockItem = {
    productId: "p1",
    nombre: "Producto A",
    cantidad: 1,
    precioUnitario: 10,
    unidad_medida: "PIEZA" as const,
  };

  it("clears the cart when tenantId changes", () => {
    const { result, rerender } = renderHook(
      ({ tenantId }: { tenantId: string | null }) => usePosCart(tenantId),
      { initialProps: { tenantId: "tenant-a" } }
    );

    act(() => {
      result.current.addItem(mockItem);
    });
    expect(useCartStore.getState().items).toHaveLength(1);

    rerender({ tenantId: "tenant-b" });

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("does not clear the cart when tenantId stays the same", () => {
    const { result, rerender } = renderHook(
      ({ tenantId }: { tenantId: string | null }) => usePosCart(tenantId),
      { initialProps: { tenantId: "tenant-a" } }
    );

    act(() => {
      result.current.addItem(mockItem);
    });

    rerender({ tenantId: "tenant-a" });

    expect(useCartStore.getState().items).toHaveLength(1);
  });
});
