import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La landing promete usuarios y productos ilimitados (2026-09-24). Antes decia
 * "Hasta 3 usuarios" mientras el sistema no limitaba nada: una promesa que no
 * coincide con el producto, en cualquier direccion, es un problema.
 */

const leer = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("usuarios ilimitados en la landing", () => {
  it("ningún texto sigue diciendo 'hasta 3 usuarios'", () => {
    for (const idioma of ["es", "en"]) {
      expect(leer(`src/messages/${idioma}.json`), idioma).not.toMatch(/hasta 3 usuarios|up to 3 users/i);
    }
  });

  it("FAQ_KEYS es igual en la sección y en la página (el JSON-LD sale de la página)", () => {
    const claves = (p: string) => leer(p).match(/const FAQ_KEYS = \[([^\]]*)\]/)?.[1];
    const seccion = claves("src/components/marketing/faq.tsx");
    expect(seccion).toBeDefined();
    expect(claves("src/app/[locale]/page.tsx")).toBe(seccion);
  });

  it("la pregunta de límites existe en los dos idiomas", () => {
    for (const idioma of ["es", "en"]) {
      const items = JSON.parse(leer(`src/messages/${idioma}.json`)).landing.faq.items;
      expect(items["9"]?.question, idioma).toBeTruthy();
      expect(items["9"]?.answer, idioma).toBeTruthy();
    }
  });
});
