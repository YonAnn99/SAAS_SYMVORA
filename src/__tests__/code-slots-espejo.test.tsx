import { useState } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeSlots, type CodeSlotsStatus } from "@/components/ui/code-slots";

/**
 * Clave de colaborador en Android (reporte del 2026-11-12): el teclado de texto
 * compone la palabra y, con el campo controlado en "", las casillas se vaciaban.
 * En modo alfanumerico el campo es espejo: el valor completo manda.
 */
function Clave({ status = "idle", onCambio }: { status?: CodeSlotsStatus; onCambio: (c: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <CodeSlots
      length={8}
      alfanumerico
      value={valor}
      status={status}
      ariaLabel="Clave"
      onChange={(c) => {
        setValor(c);
        onCambio(c);
      }}
    />
  );
}

const campo = (c: HTMLElement) => c.querySelector("input") as HTMLInputElement;
/** Lo que hace el teclado de Android: el campo trae la palabra completa, sin keydown util. */
const teclear = (input: HTMLInputElement, valor: string) => {
  fireEvent.keyDown(input, { key: "Unidentified", keyCode: 229 });
  fireEvent.change(input, { target: { value: valor } });
};

afterEach(() => vi.useRealTimers());

describe("CodeSlots alfanumérico (campo espejo)", () => {
  it("teclado de Android componiendo: no se pierde nada", () => {
    const onCambio = vi.fn();
    const { container } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    for (const v of ["9", "96", "96u", "96u8", "96u8x"]) teclear(input, v);
    expect(onCambio).toHaveBeenLastCalledWith("96U8X");
    // El campo conserva lo que escribió el teclado (no se reescribe en mayúsculas).
    expect(input.value).toBe("96u8x");
  });

  it("si el teclado re-sincroniza (borra y reinserta), queda la clave, no una letra suelta", () => {
    const onCambio = vi.fn();
    const { container } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    for (const v of ["9", "96", "96u", "96u8"]) teclear(input, v);
    teclear(input, "96u");
    teclear(input, "96u8x");
    expect(onCambio).toHaveBeenLastCalledWith("96U8X");
  });

  it("borrar con el teclado quita el último carácter", () => {
    const onCambio = vi.fn();
    const { container } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    teclear(input, "96U8X");
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.change(input, { target: { value: "96U8" } });
    expect(onCambio).toHaveBeenLastCalledWith("96U8");
  });

  it("escribir de más se recorta a 8 caracteres", () => {
    const onCambio = vi.fn();
    const { container } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    teclear(input, "abcd1234zz");
    expect(onCambio).toHaveBeenLastCalledWith("ABCD1234");
    expect(input.value).toBe("ABCD1234");
  });

  it("pegar limpia la clave y deja el campo igual", () => {
    const onCambio = vi.fn();
    const { container } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    fireEvent.paste(input, { clipboardData: { getData: () => "abc-123 xy" } });
    expect(onCambio).toHaveBeenLastCalledWith("ABC123XY");
    expect(input.value).toBe("ABC123XY");
  });

  it("al fallar, tras el drenado el campo y la clave quedan vacíos", () => {
    vi.useFakeTimers();
    const onCambio = vi.fn();
    const { container, rerender } = render(<Clave onCambio={onCambio} />);
    const input = campo(container);
    teclear(input, "96U8XQ12");
    rerender(<Clave status="error" onCambio={onCambio} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(onCambio).toHaveBeenLastCalledWith("");
    expect(input.value).toBe("");
  });
});

describe("CodeSlots numérico (sin cambios)", () => {
  it("una tecla inserta el dígito y el campo sigue vacío", () => {
    const onChange = vi.fn();
    const { container } = render(<CodeSlots length={6} onChange={onChange} />);
    const input = campo(container);
    fireEvent.keyDown(input, { key: "5" });
    expect(onChange).toHaveBeenLastCalledWith("5");
    expect(input.value).toBe("");
  });
});
