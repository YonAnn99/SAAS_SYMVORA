import { describe, expect, it } from "vitest";
import {
  CLAVES_MODULO,
  TODOS_ENCENDIDOS,
  modulosParaGiro,
  modulosPorGiro,
  normalizarModulos,
  unidadesOfrecidas,
  type ClaveModulo,
} from "@/lib/modulos";
import { GIROS, type ModuloClave } from "@/features/marketing/giros";

/**
 * Modulos de Configuracion -> Modulos. Hasta el 2026-09-24 solo se guardaban;
 * ahora ocultan las opciones de lo que esta apagado, sin borrar nada.
 */

describe("lectura de lo guardado", () => {
  it("lo que falta o no es booleano cuenta como encendido (ante la duda no se oculta)", () => {
    expect(normalizarModulos(undefined)).toEqual(TODOS_ENCENDIDOS);
    expect(normalizarModulos({ permite_granel: false, permite_variantes: "x" })).toEqual({
      ...TODOS_ENCENDIDOS,
      permite_granel: false,
    });
  });
});

describe("unidades que se ofrecen", () => {
  it("sin venta por medida no aparecen kg, g, l, ml ni m", () => {
    const u = unidadesOfrecidas({ ...TODOS_ENCENDIDOS, permite_granel: false });
    for (const x of ["KG", "GRAMO", "LITRO", "MILILITRO", "METRO"]) expect(u).not.toContain(x);
    expect(u).toContain("PIEZA");
  });

  it("sin servicios no aparece SERVICIO", () => {
    expect(unidadesOfrecidas({ ...TODOS_ENCENDIDOS, permite_servicios: false })).not.toContain("SERVICIO");
  });

  it("ESTE es el importante: la unidad actual se ofrece aunque su módulo esté apagado", () => {
    // Si no, el selector abriría en blanco y el primer clic le cambiaría la
    // unidad a un producto que ya se vende por kilo.
    const u = unidadesOfrecidas({ ...TODOS_ENCENDIDOS, permite_granel: false }, "KG");
    expect(u).toContain("KG");
  });
});

describe("módulos con los que nace una cuenta", () => {
  const NOMBRE: Record<ModuloClave, ClaveModulo> = {
    granel: "permite_granel",
    variantes: "permite_variantes",
    lotes: "permite_lotes_caducidad",
    mermas: "permite_mermas",
    servicios: "permite_servicios",
    credito: "permite_credito_fiado",
  };

  it.each(GIROS.map((g) => [g.slug, g] as const))(
    "%s nace con los módulos que su página recomienda",
    (_slug, giro) => {
      // La página del giro dice "te recomendamos encender…"; quien se registra
      // desde ahí (con ?giro=CONFIG) debe encontrarlos ya encendidos.
      // Con `modulosParaGiro` (lo que usa el registro): su configuracion mas
      // lo que recomienda su pagina.
      const modulos = modulosParaGiro(giro);
      for (const m of giro.modulos) {
        expect(modulos[NOMBRE[m]], `${giro.slug}: ${m}`).toBe(true);
      }
    }
  );

  it("florería nace con servicios aunque su configuración sea General", () => {
    const floreria = GIROS.find((g) => g.slug === "florerias")!;
    expect(floreria.config).toBe("GENERAL");
    expect(modulosParaGiro(floreria).permite_servicios).toBe(true);
  });

  it("todas las claves están definidas", () => {
    for (const giro of ["ABARROTES", "ROPA", "GENERAL", "desconocido"]) {
      expect(Object.keys(modulosPorGiro(giro)).sort()).toEqual([...CLAVES_MODULO].sort());
    }
  });
});
