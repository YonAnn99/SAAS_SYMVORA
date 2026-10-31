import { describe, expect, it } from "vitest";
import {
  ESTADO_VACIO,
  NOVEDADES,
  esNuevo,
  hoyMx,
  leerEstado,
  novedadPorMostrar,
  novedadesPara,
  novedadVigente,
} from "@/lib/novedades";
import { MODULES } from "@/lib/modules";

const catalogo = NOVEDADES.find((n) => n.id === "catalogo-en-linea")!;
const todo = () => true;
// 2026-11-05 a mediodía en CDMX.
const durante = new Date("2026-11-05T18:00:00Z");

describe("novedades", () => {
  it("cada novedad apunta a un módulo real con su mismo permiso", () => {
    for (const n of NOVEDADES) {
      const modulo = MODULES.find((m) => m.paths.includes(n.href));
      expect(modulo, n.id).toBeDefined();
      expect(modulo!.permission).toBe(n.permiso);
      expect(n.desde <= n.hasta).toBe(true);
    }
  });

  it("la vigencia se cuenta en días de Ciudad de México", () => {
    // 1 de noviembre a las 00:30 UTC sigue siendo 31 de octubre en CDMX.
    expect(hoyMx(new Date("2026-11-01T00:30:00Z"))).toBe("2026-10-31");
    expect(novedadVigente(catalogo, new Date("2026-10-30T06:30:00Z"))).toBe(true);
    expect(novedadVigente(catalogo, new Date("2026-10-30T05:30:00Z"))).toBe(false);
    expect(novedadVigente(catalogo, new Date("2026-11-21T07:00:00Z"))).toBe(false);
  });

  it("solo la ve quien tiene el permiso del módulo", () => {
    expect(novedadesPara(durante, todo)).toContain(catalogo);
    expect(novedadesPara(durante, (p) => p !== "catalog.manage")).not.toContain(catalogo);
  });

  it("la etiqueta se quita al abrir el módulo, no al descartar la ventana", () => {
    const activas = novedadesPara(durante, todo);
    expect(esNuevo("/online-catalog", activas, ESTADO_VACIO)).toBe(true);
    expect(esNuevo("/products", activas, ESTADO_VACIO)).toBe(false);
    expect(esNuevo("/online-catalog", activas, { vistas: [], descartadas: [catalogo.id] })).toBe(true);
    expect(esNuevo("/online-catalog", activas, { vistas: [catalogo.id], descartadas: [] })).toBe(false);
  });

  it("la ventana sale una sola vez: ni vista ni descartada", () => {
    const activas = novedadesPara(durante, todo);
    expect(novedadPorMostrar(activas, ESTADO_VACIO)).toBe(catalogo);
    expect(novedadPorMostrar(activas, { vistas: [catalogo.id], descartadas: [] })).toBeNull();
    expect(novedadPorMostrar(activas, { vistas: [], descartadas: [catalogo.id] })).toBeNull();
  });

  it("lo guardado se lee sin confiar en su forma", () => {
    expect(leerEstado(null)).toEqual(ESTADO_VACIO);
    expect(leerEstado("no es json")).toEqual(ESTADO_VACIO);
    expect(leerEstado('{"vistas":["a",3],"descartadas":"b"}')).toEqual({ vistas: ["a"], descartadas: [] });
  });
});
