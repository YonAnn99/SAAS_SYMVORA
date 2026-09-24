import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIAS, guiaParaRuta, guiaPorSlug, idYoutube, rutaGuia } from "@/features/marketing/aprende";
import { NAVIGATION } from "@/lib/navigation";
import sitemap from "@/app/sitemap";

/**
 * Guias de "Aprende" (/es/aprende). Lo que se vigila aqui falla en silencio:
 * un enlace del sistema que abre la guia equivocada, un video que no carga o
 * una guia que describe algo que el sistema no hace.
 */

describe("contenido de las guías", () => {
  it("12 guías, sin slugs repetidos y válidos para URL", () => {
    expect(GUIAS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(GUIAS.map((g) => g.slug)).size).toBe(GUIAS.length);
    for (const g of GUIAS) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("cada guía tiene secciones con pasos, e ids de sección únicos", () => {
    for (const g of GUIAS) {
      expect(g.secciones.length, g.slug).toBeGreaterThan(0);
      expect(new Set(g.secciones.map((s) => s.id)).size, g.slug).toBe(g.secciones.length);
      for (const s of g.secciones) expect(s.pasos.length, `${g.slug}#${s.id}`).toBeGreaterThan(0);
    }
  });

  it("las guías relacionadas existen", () => {
    for (const g of GUIAS) for (const r of g.relacionadas) expect(guiaPorSlug(r), `${g.slug} → ${r}`).toBeDefined();
  });

  it("no documenta lo que el sistema no hace", () => {
    // La facturacion (CFDI) esta apagada y exportar reportes aun no funciona.
    const prohibidas = /factura|cfdi|export(a|ar)\b.*(pdf|csv)|descarga el reporte/i;
    for (const g of GUIAS) {
      const texto = JSON.stringify({ ...g, icono: undefined });
      expect(texto, g.slug).not.toMatch(prohibidas);
    }
  });
});

describe("videos de YouTube", () => {
  const ID = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
  ])("entiende %s", (url) => {
    expect(idYoutube(url)).toBe(ID);
  });

  it.each([
    undefined,
    "",
    "no es una url",
    `https://vimeo.com/${ID}`,
    `https://youtube.com.malicioso.com/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=corto",
  ])("rechaza %s", (url) => {
    expect(idYoutube(url)).toBeNull();
  });
});

describe("enlace «Aprende» desde el sistema", () => {
  it("cada módulo principal del menú abre su guía", () => {
    const esperado: Record<string, string> = {
      "/dashboard": "reportes-y-dashboard",
      "/pos": "punto-de-venta",
      "/products": "productos-e-inventario",
      "/customers": "clientes-y-credito",
      "/finances": "caja-y-finanzas",
      "/reports": "reportes-y-dashboard",
      "/purchases": "compras-y-ordenes",
      "/purchase-orders": "compras-y-ordenes",
      "/activity": "bitacora",
      "/users": "usuarios-y-permisos",
      "/branches": "sucursales",
      "/settings": "configuracion",
      "/settings/payments": "configuracion",
      "/billing": "suscripcion",
    };
    for (const [ruta, slug] of Object.entries(esperado)) {
      expect(guiaParaRuta(ruta)?.slug, ruta).toBe(slug);
      expect(guiaParaRuta(`/es${ruta}`)?.slug, `/es${ruta}`).toBe(slug);
    }
  });

  it("todo módulo del menú que tiene guía la encuentra (no se queda uno fuera)", () => {
    const sinGuia = new Set(["/suggestions", "/facturas"]);
    for (const item of NAVIGATION) {
      if (sinGuia.has(item.href)) continue;
      expect(guiaParaRuta(item.href), item.href).toBeDefined();
    }
  });

  it("sin guía para esa pantalla, abre el índice", () => {
    expect(guiaParaRuta("/suggestions")).toBeUndefined();
    expect(rutaGuia(undefined)).toBe("/es/aprende");
  });
});

describe("publicación", () => {
  it("el sitemap incluye el índice y todas las guías", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/es/aprende"))).toBe(true);
    for (const g of GUIAS) expect(urls.some((u) => u.endsWith(rutaGuia(g.slug))), g.slug).toBe(true);
  });

  it("el middleware las trata como marketing y la CSP permite el video", () => {
    const leer = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const mw = leer("src/lib/supabase/middleware.ts");
    const segmentos = mw.slice(mw.indexOf("const MARKETING_SEGMENTS"), mw.indexOf("];", mw.indexOf("const MARKETING_SEGMENTS")));
    expect(segmentos).toContain('"/aprende"');
    expect(leer("next.config.ts")).toMatch(/frame-src[^"]*https:\/\/www\.youtube-nocookie\.com/);
  });
});
