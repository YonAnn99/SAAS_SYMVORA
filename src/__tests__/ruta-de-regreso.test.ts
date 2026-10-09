import { describe, expect, it } from "vitest";
import { rutaDeRegresoSegura, urlDeLogin } from "@/lib/ruta-de-regreso";

describe("rutaDeRegresoSegura", () => {
  it("acepta rutas internas con idioma, con o sin parametros", () => {
    expect(rutaDeRegresoSegura("/es/billing")).toBe("/es/billing");
    expect(rutaDeRegresoSegura("/es/billing?motivo=solo_lectura")).toBe(
      "/es/billing?motivo=solo_lectura"
    );
    expect(rutaDeRegresoSegura("/en/pos")).toBe("/en/pos");
    expect(rutaDeRegresoSegura("/es/dashboard?demo=1")).toBe("/es/dashboard?demo=1");
    expect(rutaDeRegresoSegura("/es")).toBe("/es");
  });

  it("rechaza otros dominios y trucos de open redirect", () => {
    expect(rutaDeRegresoSegura("//evil.com")).toBeNull();
    expect(rutaDeRegresoSegura("https://evil.com/es/billing")).toBeNull();
    expect(rutaDeRegresoSegura("/\\evil.com")).toBeNull();
    expect(rutaDeRegresoSegura("/es//evil.com")).toBeNull();
    expect(rutaDeRegresoSegura("/es/billing\n")).toBeNull();
    expect(rutaDeRegresoSegura("javascript:alert(1)")).toBeNull();
  });

  it("rechaza rutas sin idioma valido", () => {
    expect(rutaDeRegresoSegura("/billing")).toBeNull();
    expect(rutaDeRegresoSegura("/fr/billing")).toBeNull();
    expect(rutaDeRegresoSegura("/espanol/billing")).toBeNull();
  });

  it("rechaza las rutas de auth para no ciclar", () => {
    expect(rutaDeRegresoSegura("/es/auth")).toBeNull();
    expect(rutaDeRegresoSegura("/es/auth?mode=login")).toBeNull();
    expect(rutaDeRegresoSegura("/es/login")).toBeNull();
    expect(rutaDeRegresoSegura("/en/signup")).toBeNull();
    expect(rutaDeRegresoSegura("/es/reset-password")).toBeNull();
  });

  it("rechaza vacio y nulos", () => {
    expect(rutaDeRegresoSegura("")).toBeNull();
    expect(rutaDeRegresoSegura(null)).toBeNull();
    expect(rutaDeRegresoSegura(undefined)).toBeNull();
  });
});

describe("urlDeLogin", () => {
  it("manda al login con la pagina pedida en next", () => {
    expect(urlDeLogin("/es/billing")).toBe("/es/auth?mode=login&next=%2Fes%2Fbilling");
  });

  it("conserva los parametros de la pagina pedida", () => {
    expect(urlDeLogin("/es/billing", "?motivo=solo_lectura")).toBe(
      "/es/auth?mode=login&next=%2Fes%2Fbilling%3Fmotivo%3Dsolo_lectura"
    );
  });

  it("respeta el idioma de la ruta", () => {
    expect(urlDeLogin("/en/pos")).toBe("/en/auth?mode=login&next=%2Fen%2Fpos");
  });

  it("sin destino valido solo manda al login", () => {
    expect(urlDeLogin("/fr/billing")).toBe("/es/auth?mode=login");
    expect(urlDeLogin("/es//evil.com")).toBe("/es/auth?mode=login");
  });
});
