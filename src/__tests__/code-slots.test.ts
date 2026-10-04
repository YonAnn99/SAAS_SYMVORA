import { describe, expect, it } from "vitest";
import { limpiar } from "@/components/ui/code-slots";

describe("limpiar (Code Slots)", () => {
  it("por defecto deja solo dígitos, como el original de React Bits", () => {
    expect(limpiar("12-34 ab")).toBe("1234");
  });

  it("alfanumérico: pasa a mayúsculas y quita guiones y espacios", () => {
    expect(limpiar("abc-123 xy", true)).toBe("ABC123XY");
  });

  it("alfanumérico: descarta acentos y símbolos", () => {
    expect(limpiar("ñá@#9z", true)).toBe("9Z");
  });

  it("tolera undefined", () => {
    expect(limpiar(undefined, true)).toBe("");
  });
});
