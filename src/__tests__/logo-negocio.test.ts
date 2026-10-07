import { describe, it, expect } from "vitest";
import { conVersion } from "@/lib/logo-negocio";

const BASE = "https://abc.supabase.co/storage/v1/object/public/logos/u1/logo.webp";

describe("conVersion (logo del negocio)", () => {
  it("agrega la versión a la URL", () => {
    expect(conVersion(BASE, 111)).toBe(`${BASE}?v=111`);
  });

  it("reemplaza una versión anterior sin duplicarla", () => {
    expect(conVersion(`${BASE}?v=111`, 222)).toBe(`${BASE}?v=222`);
  });

  it("respeta otros parámetros", () => {
    expect(conVersion(`${BASE}?a=1`, 333)).toBe(`${BASE}?a=1&v=333`);
  });

  // EL DEFECTO (2026-10-06): con la misma URL, la barra lateral seguía con el
  // logo viejo en caché mientras el header ya mostraba el nuevo.
  it("dos subidas distintas dan URLs distintas", () => {
    expect(conVersion(BASE, 1)).not.toBe(conVersion(BASE, 2));
  });
});
