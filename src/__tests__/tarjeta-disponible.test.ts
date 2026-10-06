import { describe, expect, it } from "vitest";
import { tarjetaManualDisponible } from "@/features/pos/tarjeta-disponible";

describe("tarjetaManualDisponible", () => {
  it("bloqueada sin Mercado Pago Point ni terminal externa", () => {
    expect(tarjetaManualDisponible({ mpReady: false, terminalExterna: false, esDemo: false })).toBe(false);
  });

  it("basta con una de las dos terminales", () => {
    expect(tarjetaManualDisponible({ mpReady: true, terminalExterna: false, esDemo: false })).toBe(true);
    expect(tarjetaManualDisponible({ mpReady: false, terminalExterna: true, esDemo: false })).toBe(true);
    // Una que ya dijo que sí no espera a la otra.
    expect(tarjetaManualDisponible({ mpReady: null, terminalExterna: true, esDemo: false })).toBe(true);
    expect(tarjetaManualDisponible({ mpReady: true, terminalExterna: null, esDemo: false })).toBe(true);
  });

  it("mientras carga alguna y ninguna dijo que sí: sin resolver", () => {
    expect(tarjetaManualDisponible({ mpReady: null, terminalExterna: false, esDemo: false })).toBeNull();
    expect(tarjetaManualDisponible({ mpReady: false, terminalExterna: null, esDemo: false })).toBeNull();
  });

  it("en el demo siempre está disponible", () => {
    expect(tarjetaManualDisponible({ mpReady: false, terminalExterna: false, esDemo: true })).toBe(true);
  });
});
