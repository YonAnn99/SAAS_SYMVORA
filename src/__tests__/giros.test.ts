import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIGS_REGISTRO,
  FUNCIONES,
  GIROS,
  GIROS_FRANJA,
  MODULOS,
  giroPorSlug,
  giroDeRegistro,
  GIROS_REGISTRO,
  rutaGiro,
  rutaRegistroGiro,
} from "@/features/marketing/giros";
import sitemap from "@/app/sitemap";

/**
 * Los giros de la landing: franja, catalogo y una pagina por giro. Lo que se
 * vigila aqui es lo que, si falla, no se nota en pantalla hasta que un cliente
 * cae en una pagina rota o se registra por una promesa que no se cumple.
 */

describe("catálogo de giros", () => {
  it("unos 20 giros, sin slugs repetidos", () => {
    expect(GIROS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(GIROS.map((g) => g.slug)).size).toBe(GIROS.length);
  });

  it("los slugs son válidos para una URL", () => {
    for (const g of GIROS) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("ESTE es el importante: cada giro se registra con una configuración que existe", () => {
    // Si un giro apuntara a una configuracion inventada, "Prueba gratis" abriria
    // el registro sin giro elegido o con uno que la base rechaza.
    for (const g of GIROS) expect(CONFIGS_REGISTRO).toContain(g.config);
  });

  it("cada página tiene su contenido completo", () => {
    for (const g of GIROS) {
      expect(g.resumen.length, g.slug).toBeGreaterThan(40);
      expect(g.queEs.length, g.slug).toBeGreaterThan(150);
      expect(g.beneficios.length, g.slug).toBeGreaterThanOrEqual(4);
      expect(g.funciones.length, g.slug).toBeGreaterThanOrEqual(4);
      expect(g.faqs.length, g.slug).toBeGreaterThanOrEqual(3);
      expect(g.modulos.length, g.slug).toBeGreaterThan(0);
      for (const f of g.funciones) expect(FUNCIONES).toHaveProperty(f.clave);
      for (const m of g.modulos) expect(MODULOS).toHaveProperty(m);
    }
  });

  it("no promete lo que SYMVORA no hace", () => {
    // La facturacion (CFDI) esta apagada y no hay recetas ni agenda de citas.
    // Un cliente que se registra por eso cancela en la primera semana.
    const prohibidas = /factura|cfdi|\breceta|\bcita(s)?\b|agenda/i;
    for (const g of GIROS) {
      const texto = JSON.stringify({ ...g, icono: undefined });
      expect(texto, g.slug).not.toMatch(prohibidas);
    }
  });

  it("todo giro de la franja existe en el catálogo", () => {
    for (const slug of GIROS_FRANJA) expect(giroPorSlug(slug), slug).toBeDefined();
  });
});

describe("enlaces de cada giro", () => {
  it("la página vive en /es/punto-de-venta/{slug}", () => {
    expect(rutaGiro("papelerias")).toBe("/es/punto-de-venta/papelerias");
  });

  it("'Prueba gratis' abre el registro con ese giro elegido", () => {
    const papeleria = giroPorSlug("papelerias")!;
    expect(rutaRegistroGiro(papeleria)).toBe("/es/auth?mode=signup&giro=papelerias");
  });

  it("?giro= acepta el slug y, de enlaces viejos, la configuración", () => {
    expect(giroDeRegistro("papelerias")?.slug).toBe("papelerias");
    expect(giroDeRegistro("FERRETERIA")?.slug).toBe("ferreterias");
    expect(giroDeRegistro("GENERAL")?.slug).toBe("tiendas");
    expect(giroDeRegistro("inventado")).toBeUndefined();
    expect(giroDeRegistro(null)).toBeUndefined();
  });

  it("el registro ofrece los 20 giros, con Tienda General al final", () => {
    expect(GIROS_REGISTRO).toHaveLength(GIROS.length);
    expect(GIROS_REGISTRO.at(-1)?.slug).toBe("tiendas");
  });

  it("el sitemap incluye todas las páginas de giro", () => {
    const urls = sitemap().map((e) => e.url);
    for (const g of GIROS) {
      expect(urls.some((u) => u.endsWith(rutaGiro(g.slug))), g.slug).toBe(true);
    }
  });

  it("el middleware las trata como marketing (públicas y servidas en www)", () => {
    // Sin esto, en produccion redirigirian al host de la app y sin sesion
    // acabarian en el login. Se lee el fuente: importar el middleware arrastra
    // `next/server` (mismo enfoque que modules.test.ts).
    const middleware = readFileSync(join(process.cwd(), "src/lib/supabase/middleware.ts"), "utf8");
    const segmentos = middleware.slice(
      middleware.indexOf("const MARKETING_SEGMENTS"),
      middleware.indexOf("];", middleware.indexOf("const MARKETING_SEGMENTS"))
    );
    expect(segmentos).toContain('"/punto-de-venta"');
  });
});
