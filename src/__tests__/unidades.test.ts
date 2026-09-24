import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNIDADES,
  articulosDeLinea,
  esFraccionable,
  formatearCantidad,
  normalizarCantidad,
} from "@/lib/unidades";
import { parseUnidadMedida } from "@/features/inventory/components/products/import/import-row-processor";

/**
 * Unidades de medida y cantidades con decimales (2026-09-24). Antes el POS
 * solo sumaba de 1 en 1 y no habia metro, aunque las paginas de giro
 * prometian "cable por metro" y "precio por kilo calculado al momento".
 */

describe("la lista coincide con el enum de la base", () => {
  it("cada unidad de la app existe en alguna migración", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    for (const u of UNIDADES) expect(sql, u).toContain(`'${u}'`);
  });
});

describe("qué unidades admiten decimales", () => {
  it("las de medida sí, las de conteo no", () => {
    for (const u of ["KG", "GRAMO", "LITRO", "MILILITRO", "METRO"]) expect(esFraccionable(u), u).toBe(true);
    for (const u of ["PIEZA", "CAJA", "PAQUETE", "PAR", "DOCENA", "SERVICIO"]) expect(esFraccionable(u), u).toBe(false);
  });
});

describe("normalizarCantidad", () => {
  it("ESTE es el importante: 0.750 kg es válido, 0.5 piezas no", () => {
    expect(normalizarCantidad("0.750", "KG")).toBe(0.75);
    expect(normalizarCantidad("0.5", "PIEZA")).toBeNull();
  });

  it("acepta coma decimal y redondea a 3 decimales", () => {
    expect(normalizarCantidad("3,5", "METRO")).toBe(3.5);
    expect(normalizarCantidad("1.23456", "KG")).toBe(1.235);
  });

  it("rechaza cero, negativos, texto y vacío", () => {
    for (const v of ["0", "-1", "abc", "", "1.2.3", "0.0001"]) {
      expect(normalizarCantidad(v, "KG"), v).toBeNull();
    }
    expect(normalizarCantidad("0", "PIEZA")).toBeNull();
  });

  it("enteros de conteo: 24 piezas sí", () => {
    expect(normalizarCantidad("24", "PIEZA")).toBe(24);
    expect(normalizarCantidad(2, "PAR")).toBe(2);
  });
});

describe("cómo se muestra y cómo se cuenta", () => {
  it("con su abreviatura y sin ceros de relleno", () => {
    expect(formatearCantidad(0.75, "KG")).toBe("0.75 kg");
    expect(formatearCantidad(3.5, "METRO")).toBe("3.5 m");
    expect(formatearCantidad(1, "PIEZA")).toBe("1 pza");
    expect(formatearCantidad(2, "PAR")).toBe("2 pares");
  });

  it("una línea por medida cuenta 1 artículo, no 0.75", () => {
    expect(articulosDeLinea(0.75, "KG")).toBe(1);
    expect(articulosDeLinea(3, "PIEZA")).toBe(3);
  });
});

describe("importar desde Excel reconoce las unidades", () => {
  it.each([
    ["m", "METRO"],
    ["Mts", "METRO"],
    ["ml", "MILILITRO"],
    ["Kilos", "KG"],
    ["Caja", "CAJA"],
    ["paq", "PAQUETE"],
    ["Pares", "PAR"],
    ["doc", "DOCENA"],
    ["pza.", "PIEZA"],
    ["algo raro", "PIEZA"],
  ])("%s → %s", (entrada, esperado) => {
    expect(parseUnidadMedida(entrada)).toBe(esperado);
  });
});
