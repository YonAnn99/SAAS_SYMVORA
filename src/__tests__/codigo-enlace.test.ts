import { describe, expect, it } from "vitest";
import {
  FORMATO_CODIGO,
  LARGO_CODIGO,
  generarCodigoEnlace,
} from "@/features/inventory/codigo-enlace";

describe("generarCodigoEnlace", () => {
  it("son 10 caracteres base62", () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigoEnlace();
      expect(c).toHaveLength(LARGO_CODIGO);
      expect(FORMATO_CODIGO.test(c)).toBe(true);
    }
  });

  it("no se repiten", () => {
    const vistos = new Set(Array.from({ length: 1000 }, generarCodigoEnlace));
    expect(vistos.size).toBe(1000);
  });

  it("el formato rechaza lo que no es un codigo", () => {
    for (const malo of ["", "abc", "abcdefghij1", "abc/../def", "abcdefgh!j"]) {
      expect(FORMATO_CODIGO.test(malo), malo).toBe(false);
    }
  });
});
