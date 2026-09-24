import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completarRegistroSchema } from "@/lib/validations/schemas";

/**
 * es.json y en.json tienen que tener LAS MISMAS claves.
 *
 * Una clave que falta en un idioma no rompe nada al compilar: next-intl pinta
 * la clave en crudo. Asi llego a produccion `tutorial.replayHelp` en la barra
 * superior de todo usuario en ingles, con el tutorial entero sin traducir (42
 * claves). Este test es lo que impide que vuelva a pasar en silencio.
 */

function claves(obj: unknown, ruta = ""): string[] {
  if (!obj || typeof obj !== "object") return [ruta];
  return Object.entries(obj).flatMap(([k, v]) => claves(v, ruta ? `${ruta}.${k}` : k));
}

function leer(idioma: "es" | "en"): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "src", "messages", `${idioma}.json`), "utf8"));
}

describe("traducciones", () => {
  const es = new Set(claves(leer("es")));
  const en = new Set(claves(leer("en")));

  it("ESTE es el importante: nada de español sin su inglés", () => {
    expect([...es].filter((k) => !en.has(k))).toEqual([]);
  });

  it("ni claves en inglés que el español no tenga", () => {
    expect([...en].filter((k) => !es.has(k))).toEqual([]);
  });
});

describe("«Completa tu registro» (entrada con Google)", () => {
  const valido = {
    nombre: "Ana López",
    nombre_establecimiento: "Abarrotes Ana",
    giro: "papelerias",
    acceptTerms: true,
  };

  it("acepta los datos del negocio sin contraseña ni correo", () => {
    expect(completarRegistroSchema.safeParse(valido).success).toBe(true);
  });

  it("no deja pasar sin aceptar los términos", () => {
    expect(completarRegistroSchema.safeParse({ ...valido, acceptTerms: false }).success).toBe(false);
  });

  it("rechaza un giro que no existe", () => {
    expect(completarRegistroSchema.safeParse({ ...valido, giro: "inventado" }).success).toBe(false);
  });

  it("un nombre de negocio de puros espacios no cuenta", () => {
    expect(
      completarRegistroSchema.safeParse({ ...valido, nombre_establecimiento: "   " }).success
    ).toBe(false);
  });
});
