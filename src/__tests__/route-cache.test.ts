import { describe, expect, it } from "vitest";
import {
  APP_PAGE_PATH,
  APP_PAGES_CACHE,
  OFFLINE_ROUTES,
} from "@/lib/offline/route-cache";

describe("rutas que el service worker guarda para usar sin conexión", () => {
  it("cubre todas las rutas que el cliente precalienta", () => {
    // La invariante que importa: si el cliente pide una ruta que el service
    // worker manda a otra caché, lo precalentado no se usa nunca y el fallo es
    // invisible hasta que alguien se queda sin red.
    for (const route of OFFLINE_ROUTES) {
      expect(APP_PAGE_PATH.test(`/es${route}`)).toBe(true);
      expect(APP_PAGE_PATH.test(`/en${route}`)).toBe(true);
    }
  });

  it("incluye el start_url del manifest", () => {
    // `manifest.ts` arranca la PWA en /es/dashboard: si esa ruta no se guarda,
    // abrir la app en modo avión no encuentra nada y cae en /offline.html.
    expect(APP_PAGE_PATH.test("/es/dashboard")).toBe(true);
  });

  it("cubre las subrutas del Punto de Venta", () => {
    expect(APP_PAGE_PATH.test("/es/pos/historial")).toBe(true);
  });

  it("no se traga rutas ajenas que empiezan igual", () => {
    // Un `includes("/pos")` a secas habría capturado estas.
    expect(APP_PAGE_PATH.test("/es/posiciones")).toBe(false);
    expect(APP_PAGE_PATH.test("/es/dashboards-viejos")).toBe(false);
  });

  it("deja fuera lo que tiene su propia estrategia", () => {
    expect(APP_PAGE_PATH.test("/api/ventas")).toBe(false);
    expect(APP_PAGE_PATH.test("/_next/static/chunks/main.js")).toBe(false);
    expect(APP_PAGE_PATH.test("/es/billing")).toBe(false);
    expect(APP_PAGE_PATH.test("/es")).toBe(false);
  });

  it("exige el prefijo de idioma", () => {
    // Sin locale la app redirige; guardar el redirect serviría una página
    // equivocada sin conexión.
    expect(APP_PAGE_PATH.test("/dashboard")).toBe(false);
  });

  it("la caché tiene nombre propio, separado de las de serwist", () => {
    // En `others` caducaba a las 24 h y competía por 32 huecos con todo lo
    // demás: un fin de semana sin abrir la app bastaba para perder el POS.
    expect(APP_PAGES_CACHE).toBe("symvora-app-pages");
    expect(APP_PAGES_CACHE.startsWith("serwist")).toBe(false);
  });

  it("el patrón no guarda estado entre llamadas", () => {
    // Con la bandera /g, `test()` avanza `lastIndex` y alterna true/false.
    expect(APP_PAGE_PATH.flags).not.toContain("g");
    expect(APP_PAGE_PATH.test("/es/pos")).toBe(true);
    expect(APP_PAGE_PATH.test("/es/pos")).toBe(true);
  });
});
