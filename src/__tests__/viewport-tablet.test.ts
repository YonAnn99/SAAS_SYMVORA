import { describe, expect, it } from "vitest";
import { scriptViewportTablet, viewportDeseado, type EntradaViewport } from "@/lib/viewport-tablet";

const tablet = (extra: Partial<EntradaViewport> = {}): EntradaViewport => ({
  tactil: true,
  ladoCorto: 600,
  ladoLargo: 960,
  horizontal: true,
  ...extra,
});

describe("viewportDeseado", () => {
  it("tablet táctil de 960 px en horizontal → escritorio", () => {
    expect(viewportDeseado(tablet())).toBe("escritorio");
  });

  it("la misma tablet en vertical → normal", () => {
    expect(viewportDeseado(tablet({ horizontal: false }))).toBe("normal");
  });

  it("tablet que ya mide 1024 px o más → normal (no hace falta escalar)", () => {
    expect(viewportDeseado(tablet({ ladoLargo: 1024, ladoCorto: 768 }))).toBe("normal");
    expect(viewportDeseado(tablet({ ladoLargo: 1280, ladoCorto: 800 }))).toBe("normal");
  });

  it("celular en horizontal (lado corto < 600) → normal", () => {
    expect(viewportDeseado({ tactil: true, ladoCorto: 430, ladoLargo: 932, horizontal: true })).toBe("normal");
  });

  it("equipo sin táctil (laptop, monitor) → normal", () => {
    expect(viewportDeseado(tablet({ tactil: false }))).toBe("normal");
  });

  it("iOS y Android dan lo mismo con las mismas medidas", () => {
    expect(viewportDeseado(tablet({ ladoCorto: 820, ladoLargo: 1180 }))).toBe("normal");
    expect(viewportDeseado(tablet({ ladoCorto: 768, ladoLargo: 1000 }))).toBe("escritorio");
  });
});

/** Ejecuta el script en línea con un `window`, `document`, `screen` y `navigator` simulados. */
function correrScript(config: {
  ancho: number;
  alto: number;
  tactil: boolean;
  horizontal: boolean;
  contenidoInicial: string;
}) {
  const meta = {
    attrs: { content: config.contenidoInicial } as Record<string, string>,
    getAttribute(n: string) {
      return this.attrs[n] ?? null;
    },
    setAttribute(n: string, v: string) {
      this.attrs[n] = v;
    },
  };
  const listeners: Array<() => void> = [];
  const doc = { querySelector: (sel: string) => (sel === 'meta[name="viewport"]' ? meta : null) };
  const win: Record<string, unknown> = {
    matchMedia: (q: string) => ({
      matches: q === "(orientation: landscape)" ? config.horizontal : q === "(pointer: coarse)" ? config.tactil : false,
    }),
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  const pantalla = { width: config.ancho, height: config.alto };
  const nav = { maxTouchPoints: config.tactil ? 5 : 0 };
  const fn = new Function("window", "document", "screen", "navigator", scriptViewportTablet());
  fn(win, doc, pantalla, nav);
  return { meta, listeners, pantalla, nav };
}

describe("scriptViewportTablet", () => {
  it("una tablet en horizontal recibe width=1024 y guarda el original", () => {
    const r = correrScript({ ancho: 960, alto: 600, tactil: true, horizontal: true, contenidoInicial: "width=device-width, initial-scale=1" });
    expect(r.meta.attrs.content).toBe("width=1024, initial-scale=1, maximum-scale=5");
    expect(r.meta.attrs["data-original"]).toBe("width=device-width, initial-scale=1");
  });

  it("al girar a vertical vuelve al viewport original", () => {
    const r = correrScript({ ancho: 960, alto: 600, tactil: true, horizontal: false, contenidoInicial: "width=device-width, initial-scale=1" });
    expect(r.meta.attrs.content).toBe("width=device-width, initial-scale=1");
  });

  it("un celular en horizontal no se toca", () => {
    const r = correrScript({ ancho: 932, alto: 430, tactil: true, horizontal: true, contenidoInicial: "width=device-width, initial-scale=1" });
    expect(r.meta.attrs.content).toBe("width=device-width, initial-scale=1");
  });

  it("se registra un solo listener de resize", () => {
    const r = correrScript({ ancho: 960, alto: 600, tactil: true, horizontal: true, contenidoInicial: "width=device-width" });
    expect(r.listeners).toHaveLength(1);
  });
});
