import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NARRATION_SECTIONS } from "@/components/marketing/audio-config";

function leerMensajes(idioma: "es" | "en"): unknown {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src", "messages", `${idioma}.json`), "utf8")
  );
}

function valorPorRuta(mensajes: unknown, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((valor, parte) => {
    if (!valor || typeof valor !== "object") return undefined;
    return (valor as Record<string, unknown>)[parte];
  }, mensajes);
}

describe("narración de la landing", () => {
  it("asocia cada audio con su módulo en el orden de la página", () => {
    expect(
      NARRATION_SECTIONS.map(({ id, labelKey, src }) => ({
        id,
        labelKey,
        src,
      }))
    ).toEqual([
      {
        id: "features",
        labelKey: "landing.features.title",
        src: "/audio/landing/todo-lo-que-tu-negocio-necesita.v2.mp3",
      },
      {
        id: "why-choose-us",
        labelKey: "landing.whyChooseUs.title",
        src: "/audio/landing/por-que-elegir-symvora.v2.mp3",
      },
      {
        id: "security",
        labelKey: "landing.security.title",
        src: "/audio/landing/tus-datos-estan-protegidos.v2.mp3",
      },
      {
        id: "benefits",
        labelKey: "landing.benefits.title",
        src: "/audio/landing/disenado-para-quien-tiene-prisa.v2.mp3",
      },
      {
        id: "setup",
        labelKey: "landing.setup.title",
        src: "/audio/landing/en-4-pasos-estas-vendiendo.v2.mp3",
      },
    ]);
  });

  it("no repite secciones ni archivos", () => {
    expect(new Set(NARRATION_SECTIONS.map(({ id }) => id)).size).toBe(
      NARRATION_SECTIONS.length
    );
    expect(new Set(NARRATION_SECTIONS.map(({ src }) => src)).size).toBe(
      NARRATION_SECTIONS.length
    );
  });

  it("usa rutas públicas seguras y los archivos existen", () => {
    for (const { src } of NARRATION_SECTIONS) {
      const relativePath = src.replace(/^\/+/, "");

      expect(relativePath.startsWith("audio/landing/")).toBe(true);
      expect(relativePath).not.toContain(" ");
      expect(relativePath).not.toContain("\n");
      expect(existsSync(join(process.cwd(), "public", relativePath))).toBe(true);
    }
  });

  it("tiene el nombre de cada módulo traducido en español e inglés", () => {
    const es = leerMensajes("es");
    const en = leerMensajes("en");

    for (const { labelKey } of NARRATION_SECTIONS) {
      expect(valorPorRuta(es, labelKey)).toEqual(expect.any(String));
      expect(valorPorRuta(en, labelKey)).toEqual(expect.any(String));
    }
  });
});
