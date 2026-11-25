import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAQ_KEYS_NIVELES } from "@/features/marketing/faq-claves";
import { precioNivelMXN } from "@/lib/niveles";

const mensajes = (idioma: string) =>
  JSON.parse(readFileSync(`src/messages/${idioma}.json`, "utf8")) as {
    landing: { faq: { items: Record<string, { question: string; answer: string }> } };
  };

describe("FAQ con niveles", () => {
  it("todas las claves existen en los dos idiomas", () => {
    for (const idioma of ["es", "en"]) {
      const items = mensajes(idioma).landing.faq.items;
      for (const k of FAQ_KEYS_NIVELES) {
        expect(items[k]?.question, `${idioma} ${k}`).toBeTruthy();
        expect(items[k]?.answer, `${idioma} ${k}`).toBeTruthy();
      }
    }
  });

  it("los precios del FAQ son los de la tabla de niveles", () => {
    for (const idioma of ["es", "en"]) {
      const r = mensajes(idioma).landing.faq.items["3n"].answer;
      expect(r).toContain(`$${precioNivelMXN("basico", "monthly")}`);
      expect(r).toContain(`$${precioNivelMXN("pro", "monthly")}`);
      expect(r).toContain(`$${precioNivelMXN("premium", "monthly")}`);
    }
  });

  it("el cambio de plan se hace por WhatsApp o por el correo de soporte", () => {
    for (const idioma of ["es", "en"]) {
      const r = mensajes(idioma).landing.faq.items["10"].answer;
      expect(r).toContain("WhatsApp");
      expect(r).toContain("soporte@symvora.com.mx");
    }
  });

  it("no afirma «el mismo precio para todos» ni el precio unico de $399", () => {
    for (const idioma of ["es", "en"]) {
      const items = mensajes(idioma).landing.faq.items;
      for (const k of ["3n", "5n", "9n", "10", "11"]) {
        expect(items[k].answer).not.toContain("$399");
      }
    }
  });
});
