import { describe, expect, it } from "vitest";
import { esChoqueDeConcurrencia } from "@/features/pos/services/pos-service";

describe("esChoqueDeConcurrencia", () => {
  it("reconoce deadlock y fallo de serializacion (se pueden reintentar)", () => {
    expect(esChoqueDeConcurrencia({ code: "40P01" })).toBe(true);
    expect(esChoqueDeConcurrencia({ code: "40001" })).toBe(true);
  });

  it("no reintenta errores de negocio ni de red", () => {
    expect(esChoqueDeConcurrencia({ code: "P0001", message: "Stock insuficiente" })).toBe(false);
    expect(esChoqueDeConcurrencia(new Error("Failed to fetch"))).toBe(false);
    expect(esChoqueDeConcurrencia(null)).toBe(false);
  });
});
