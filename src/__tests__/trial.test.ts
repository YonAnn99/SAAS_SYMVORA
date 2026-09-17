import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAS_PRUEBA } from "@/lib/trial";
import { aplicarConstantes } from "@/i18n/constantes";

/**
 * La duracion de la prueba vive en DOS sitios que no pueden compartir una
 * constante: `public.dias_de_prueba()` en SQL manda sobre la duracion real, y
 * `DIAS_PRUEBA` en TypeScript alimenta los textos. Estos test son lo unico que
 * impide que se separen y que la landing prometa una cosa mientras la base hace
 * otra.
 */

const RAIZ = process.cwd();

function leerMigracionDeLaPrueba(): string {
  const dir = join(RAIZ, "supabase", "migrations");
  // Por nombre y no por numero fijo: si mañana se renumera, el test sigue.
  const archivo = readdirSync(dir).find((f) => f.includes("prueba_") && f.endsWith(".sql"));
  if (!archivo) throw new Error("No encontré la migración de la prueba gratuita");
  return readFileSync(join(dir, archivo), "utf8");
}

describe("duración de la prueba gratuita", () => {
  it("la de la base coincide con la del código", () => {
    // ESTE es el test que importa. Sin él, cambiar el 14 en un solo lado deja
    // la app mintiendo: los textos dirían una cosa y `complete_onboarding`
    // crearía otra, y nadie se daría cuenta hasta que un cliente reclamara.
    const sql = leerMigracionDeLaPrueba();
    const encontrado = sql.match(
      /FUNCTION\s+public\.dias_de_prueba\(\)[\s\S]*?SELECT\s+(\d+)/i
    );
    expect(encontrado, "no pude leer el número de dias_de_prueba()").not.toBeNull();
    expect(Number(encontrado![1])).toBe(DIAS_PRUEBA);
  });

  it("el alta de cuentas no fija la duración con un literal", () => {
    // `complete_onboarding` tenía `INTERVAL '7 days'` escrito a mano. Si alguien
    // vuelve a meter un literal ahí, el cambio de duración deja de tener efecto.
    const sql = leerMigracionDeLaPrueba();
    expect(sql).not.toMatch(/INTERVAL\s+'\d+\s+days'/i);
    expect(sql).toContain("make_interval(days => public.dias_de_prueba())");
  });
});

describe("textos de la prueba", () => {
  const IDIOMAS = ["es", "en"] as const;

  /** Recorre el JSON devolviendo [ruta, texto] de cada cadena. */
  function cadenas(obj: unknown, ruta = ""): [string, string][] {
    if (typeof obj === "string") return [[ruta, obj]];
    if (!obj || typeof obj !== "object") return [];
    return Object.entries(obj).flatMap(([k, v]) =>
      cadenas(v, ruta ? `${ruta}.${k}` : k)
    );
  }

  it.each(IDIOMAS)(
    "ningún texto de %s escribe la duración a mano",
    (idioma) => {
      const json = JSON.parse(
        readFileSync(join(RAIZ, "src", "messages", `${idioma}.json`), "utf8")
      );

      // Solo donde se habla de la prueba. Fuera quedan cosas legítimas como
      // "alertas a 7 y 30 días" (caducidad de lotes) o "24/7".
      const sospechosas = cadenas(json).filter(([ruta, texto]) => {
        const hablaDePrueba = /prueba|trial/i.test(texto);
        const llevaNumero =
          /\b\d+\s*(días|dias|day)/i.test(texto) ||
          /\b\d+-day/i.test(texto) ||
          /\b(siete|catorce|seven|fourteen)\b/i.test(texto);
        // `{dias}` parametrizado es justo lo que queremos.
        return hablaDePrueba && llevaNumero && !texto.includes("{dias}") &&
          !ruta.startsWith("billing."); // usa {days}, ya parametrizado
      });

      expect(
        sospechosas,
        `Estas cadenas llevan la duración escrita a mano; usa {dias}:\n` +
          sospechosas.map(([r, t]) => `  ${r}: ${t}`).join("\n")
      ).toEqual([]);
    }
  );
});

describe("inyección de constantes en los mensajes", () => {
  it("rellena {dias} sin que nadie lo pase en la llamada", () => {
    // Este es el fallo que se corrigió: la clave de las preguntas frecuentes
    // se consume desde DOS sitios (la sección de FAQ y los datos estructurados
    // de SEO de la misma página). Uno pasaba `{ dias }` y el otro no, y la
    // landing reventaba con FORMATTING_ERROR.
    const salida = aplicarConstantes({
      landing: { faq: { q: "¿Qué pasa al terminar la prueba de {dias} días?" } },
    });
    expect(salida.landing.faq.q).toBe(
      `¿Qué pasa al terminar la prueba de ${DIAS_PRUEBA} días?`
    );
  });

  it("deja intactos los parámetros de verdad", () => {
    // `{days}` de `billing.trialEndsIn` depende de CADA suscripción: tiene que
    // seguir resolviéndolo next-intl en la llamada, no esta función.
    const salida = aplicarConstantes({
      billing: { trialEndsIn: "Tu prueba termina en {days} días" },
      otro: "Hola {nombre}, tienes {count} productos",
    });
    expect(salida.billing.trialEndsIn).toBe("Tu prueba termina en {days} días");
    expect(salida.otro).toBe("Hola {nombre}, tienes {count} productos");
  });

  it("recorre objetos anidados y listas", () => {
    const salida = aplicarConstantes({
      a: { b: { c: ["{dias} días", { d: "y {dias} más" }] } },
    });
    expect(salida.a.b.c[0]).toBe(`${DIAS_PRUEBA} días`);
    expect((salida.a.b.c[1] as { d: string }).d).toBe(`y ${DIAS_PRUEBA} más`);
  });

  it("los mensajes reales de los dos idiomas quedan sin {dias} pendiente", () => {
    // La prueba de fondo: tras la inyección no puede sobrevivir ni un `{dias}`,
    // porque cualquiera que quede provoca FORMATTING_ERROR en pantalla.
    for (const idioma of ["es", "en"]) {
      const crudo = JSON.parse(
        readFileSync(join(RAIZ, "src", "messages", `${idioma}.json`), "utf8")
      );
      const pendientes = JSON.stringify(aplicarConstantes(crudo)).match(/\{dias\}/g);
      expect(pendientes, `quedan {dias} sin rellenar en ${idioma}.json`).toBeNull();
    }
  });
});
