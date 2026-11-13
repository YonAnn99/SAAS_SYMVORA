import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TRAMO_LISTA, siguienteTramo, useListaPorPartes } from "@/hooks/use-lista-por-partes";

describe("lista por partes (Productos con catálogos grandes)", () => {
  it("siguienteTramo nunca pasa del total", () => {
    expect(siguienteTramo(60, 1000)).toBe(120);
    expect(siguienteTramo(960, 1000)).toBe(1000);
    expect(siguienteTramo(0, 10)).toBe(10);
  });

  it("pinta el primer tramo y crece al pedir más", () => {
    const { result } = renderHook(() => useListaPorPartes(1016, "a"));
    expect(result.current.visibles).toBe(TRAMO_LISTA);
    expect(result.current.hayMas).toBe(true);
    expect(result.current.restantes).toBe(1016 - TRAMO_LISTA);
    act(() => result.current.mostrarMas());
    expect(result.current.visibles).toBe(TRAMO_LISTA * 2);
  });

  it("una lista corta se pinta completa", () => {
    const { result } = renderHook(() => useListaPorPartes(12, "a"));
    expect(result.current.visibles).toBe(12);
    expect(result.current.hayMas).toBe(false);
  });

  it("cambiar la búsqueda vuelve al primer tramo; borrar un producto no", () => {
    const { result, rerender } = renderHook(
      ({ total, clave }: { total: number; clave: string }) => useListaPorPartes(total, clave),
      { initialProps: { total: 1016, clave: "|{}" } }
    );
    act(() => result.current.mostrarMas());
    act(() => result.current.mostrarMas());
    expect(result.current.visibles).toBe(TRAMO_LISTA * 3);
    // Se borró un producto: misma clave, se conserva el lugar.
    rerender({ total: 1015, clave: "|{}" });
    expect(result.current.visibles).toBe(TRAMO_LISTA * 3);
    // Búsqueda nueva y luego se limpia: de vuelta al primer tramo.
    rerender({ total: 3, clave: "agua|{}" });
    expect(result.current.visibles).toBe(3);
    rerender({ total: 1015, clave: "|{}" });
    expect(result.current.visibles).toBe(TRAMO_LISTA);
  });
});
