import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { CLAVE_CARRITO, useCartStore, vaciarCarritoGuardado } from "@/features/pos/stores/cart";

const mockItem = {
  productId: "p1",
  varianteId: null,
  nombre: "Producto A",
  cantidad: 1,
  precioUnitario: 10,
  unidad_medida: "PIEZA" as const,
};

type Props = { tenantId: string | null; userId: string | null };
const montar = (initialProps: Props) =>
  renderHook(({ tenantId, userId }: Props) => usePosCart(tenantId, userId), { initialProps });

/** Simula recargar la pagina: memoria vacia, sessionStorage intacto. */
function recargar() {
  // `setState` tambien escribe en sessionStorage (persist): se respalda antes.
  const crudo = sessionStorage.getItem(CLAVE_CARRITO);
  useCartStore.setState({ items: [], duenio: null, includeIva: false, descuentoTicket: null });
  if (crudo) sessionStorage.setItem(CLAVE_CARRITO, crudo);
}

function guardado() {
  const crudo = sessionStorage.getItem(CLAVE_CARRITO);
  return crudo ? (JSON.parse(crudo) as { state: { items: unknown[]; duenio: string | null } }) : null;
}

describe("usePosCart: dueño del carrito", () => {
  beforeEach(() => {
    vaciarCarritoGuardado();
    sessionStorage.clear();
  });

  it("vacía el carrito si cambia el negocio", () => {
    const { result, rerender } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));
    expect(useCartStore.getState().items).toHaveLength(1);

    rerender({ tenantId: "tenant-b", userId: "u1" });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("vacía el carrito si cambia el usuario", () => {
    const { result, rerender } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));

    rerender({ tenantId: "tenant-a", userId: "u2" });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("no lo vacía si el negocio sigue siendo el mismo", () => {
    const { result, rerender } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));

    rerender({ tenantId: "tenant-a", userId: "u1" });
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("no lo toca mientras el negocio aún carga (null)", () => {
    const { result, rerender } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));

    rerender({ tenantId: null, userId: null });
    expect(useCartStore.getState().items).toHaveLength(1);
    rerender({ tenantId: "tenant-a", userId: "u1" });
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

describe("usePosCart: el carrito sobrevive a la recarga", () => {
  beforeEach(() => {
    vaciarCarritoGuardado();
    sessionStorage.clear();
  });

  // EL DEFECTO (2026-10-06): en el celular, tras recargar deslizando, la barra
  // decia "El carrito está vacío" pero al agregar reaparecian los anteriores.
  it("al recargar se ve lo mismo que habia, y agregar suma sobre eso", () => {
    const primera = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => {
      primera.result.current.addItem(mockItem);
      primera.result.current.addItem(mockItem);
    });
    expect(guardado()?.state.items).toHaveLength(1);
    primera.unmount();

    recargar();
    // Mientras el negocio carga, el carrito ya se ve restaurado.
    const segunda = montar({ tenantId: null, userId: null });
    expect(segunda.result.current.itemCount).toBe(2);
    expect(segunda.result.current.restaurado).toBe(false);

    segunda.rerender({ tenantId: "tenant-a", userId: "u1" });
    expect(segunda.result.current.restaurado).toBe(true);
    expect(segunda.result.current.itemCount).toBe(2);

    act(() => segunda.result.current.addItem(mockItem));
    expect(segunda.result.current.itemCount).toBe(3);
  });

  it("un carrito guardado de otro negocio no se hereda tras recargar", () => {
    const primera = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => primera.result.current.addItem(mockItem));
    primera.unmount();

    recargar();
    const segunda = montar({ tenantId: "tenant-b", userId: "u1" });
    expect(segunda.result.current.itemCount).toBe(0);
    expect(guardado()?.state.items).toHaveLength(0);
  });

  it("vaciar (cobrar) también vacía lo guardado", () => {
    const { result } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));
    act(() => result.current.clearCart());
    expect(guardado()?.state.items).toHaveLength(0);
  });

  it("cerrar sesión borra el carrito guardado", () => {
    const { result } = montar({ tenantId: "tenant-a", userId: "u1" });
    act(() => result.current.addItem(mockItem));
    act(() => vaciarCarritoGuardado());
    expect(sessionStorage.getItem(CLAVE_CARRITO)).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
