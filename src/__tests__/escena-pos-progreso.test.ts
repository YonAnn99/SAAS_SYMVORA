import { describe, expect, it } from "vitest";
import { progresoEscena } from "@/components/marketing/escena-pos/progreso";

describe("progresoEscena", () => {
  // Contenedor de 400 px de alto, ventana de 100 px: recorrido de 300 px.
  it("vale 0 cuando la escena aún no llega al tope", () => {
    expect(progresoEscena(100, 400, 100)).toBe(0);
    expect(progresoEscena(0, 400, 100)).toBe(0);
  });

  it("avanza linealmente mientras se sube", () => {
    expect(progresoEscena(-150, 400, 100)).toBeCloseTo(0.5);
    expect(progresoEscena(-75, 400, 100)).toBeCloseTo(0.25);
  });

  it("se queda en 1 al terminar el recorrido", () => {
    expect(progresoEscena(-300, 400, 100)).toBe(1);
    expect(progresoEscena(-900, 400, 100)).toBe(1);
  });

  it("sin recorrido útil (contenedor no más alto que la ventana) vale 0", () => {
    expect(progresoEscena(-50, 100, 100)).toBe(0);
    expect(progresoEscena(-50, 80, 100)).toBe(0);
  });

  it("nunca devuelve NaN", () => {
    expect(progresoEscena(Number.NaN, 400, 100)).toBe(0);
  });
});
