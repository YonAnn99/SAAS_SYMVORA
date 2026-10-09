import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNIDADES,
  articulosDeLinea,
  cantidadPorImporte,
  enUnidad,
  esFraccionable,
  formatearCantidad,
  normalizarCantidad,
  porUnidad,
  contenidoCapturado,
  contenidoDe,
  contenidoDesdeTexto,
  formatearContenido,
  pareceEmpaquetado,
  textoContenido,
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

describe("granel: etiquetas y venta por importe", () => {
  it("las etiquetas dicen por qué unidad es el precio y el stock", () => {
    expect(porUnidad("KG")).toBe(" por kg");
    expect(porUnidad("LITRO")).toBe(" por l");
    expect(porUnidad("PIEZA")).toBe("");
    expect(enUnidad("METRO")).toBe(" (m)");
    expect(enUnidad("CAJA")).toBe("");
  });

  it("convierte un importe en la cantidad, con 3 decimales", () => {
    expect(cantidadPorImporte(50, 180, "KG")).toBe(0.278);
    expect(cantidadPorImporte("90", 180, "KG")).toBe(0.5);
    expect(cantidadPorImporte("12,5", 25, "LITRO")).toBe(0.5);
  });

  it("sin importe o sin precio no hay cantidad", () => {
    expect(cantidadPorImporte(0, 180, "KG")).toBeNull();
    expect(cantidadPorImporte("abc", 180, "KG")).toBeNull();
    expect(cantidadPorImporte(50, 0, "KG")).toBeNull();
    expect(cantidadPorImporte(0.0001, 180, "KG")).toBeNull();
  });
});

describe("contenido del envase (migracion 114)", () => {
  it("formatearContenido: abreviatura de etiqueta y sin ceros de relleno", () => {
    expect(formatearContenido(2.5, "LITRO")).toBe("2.5 L");
    expect(formatearContenido("600.000", "MILILITRO")).toBe("600 ml");
    expect(formatearContenido(45, "GRAMO")).toBe("45 g");
    expect(formatearContenido(1, "KG")).toBe("1 kg");
    expect(formatearContenido(3, "METRO")).toBe("3 m");
    expect(formatearContenido(1, "PIEZA")).toBe("");
    expect(formatearContenido(null, "LITRO")).toBe("");
    expect(formatearContenido(0, "LITRO")).toBe("");
  });

  it("contenidoDe: el de la variante si tiene, si no el del producto", () => {
    const producto = { contenido_cantidad: 1, contenido_unidad: "LITRO" };
    expect(contenidoDe(producto, { contenido_cantidad: 2.5, contenido_unidad: "LITRO" })).toEqual({
      cantidad: 2.5,
      unidad: "LITRO",
    });
    expect(contenidoDe(producto, { contenido_cantidad: null, contenido_unidad: null })).toEqual({
      cantidad: 1,
      unidad: "LITRO",
    });
    expect(contenidoDe(producto)).toEqual({ cantidad: 1, unidad: "LITRO" });
    expect(contenidoDe({ contenido_cantidad: null, contenido_unidad: null })).toBeNull();
    // La base devuelve numeric como texto.
    expect(contenidoDe({ contenido_cantidad: "600.000" as unknown as number, contenido_unidad: "MILILITRO" })).toEqual({
      cantidad: 600,
      unidad: "MILILITRO",
    });
  });

  it("contenidoDesdeTexto: lee medidas escritas de varias formas", () => {
    expect(contenidoDesdeTexto("2.5 L")).toEqual({ cantidad: 2.5, unidad: "LITRO" });
    expect(contenidoDesdeTexto("Coca-Cola 600ml")).toEqual({ cantidad: 600, unidad: "MILILITRO" });
    expect(contenidoDesdeTexto("Leche 1,5 litros")).toEqual({ cantidad: 1.5, unidad: "LITRO" });
    expect(contenidoDesdeTexto("Totis Original 60g")).toEqual({ cantidad: 60, unidad: "GRAMO" });
    expect(contenidoDesdeTexto("Detergente Ace 1kg")).toEqual({ cantidad: 1, unidad: "KG" });
    expect(contenidoDesdeTexto("Aceite Nutrioli 1 Lt")).toEqual({ cantidad: 1, unidad: "LITRO" });
  });

  it("contenidoDesdeTexto: no confunde piezas ni palabras con medidas", () => {
    expect(contenidoDesdeTexto("Huevo San Juan 12pz")).toBeNull();
    expect(contenidoDesdeTexto("12 manzanas")).toBeNull();
    expect(contenidoDesdeTexto("Pan Bimbo Doble Fibra")).toBeNull();
    expect(contenidoDesdeTexto("abc")).toBeNull();
    expect(contenidoDesdeTexto("")).toBeNull();
    expect(contenidoDesdeTexto(null)).toBeNull();
  });

  it("pareceEmpaquetado: por el nombre o por un atributo", () => {
    expect(pareceEmpaquetado("Coca Cola 2.5 L")).toBe(true);
    expect(pareceEmpaquetado("Coca Cola", [{ valor: "600 ml" }])).toBe(true);
    expect(pareceEmpaquetado("Coca Cola", ["Roja"])).toBe(false);
    expect(pareceEmpaquetado("Arroz")).toBe(false);
  });
});

describe("contenidoCapturado", () => {
  it("vacio = sin contenido", () => {
    expect(contenidoCapturado("  ", "")).toEqual({ ok: true, contenido_cantidad: null, contenido_unidad: null });
  });
  it("con cantidad y medida se guarda normalizado", () => {
    expect(contenidoCapturado("2,5", "LITRO")).toEqual({ ok: true, contenido_cantidad: 2.5, contenido_unidad: "LITRO" });
  });
  it("cantidad sin medida, medida de conteo o cantidad invalida: error", () => {
    expect(contenidoCapturado("600", "").ok).toBe(false);
    expect(contenidoCapturado("1", "PIEZA").ok).toBe(false);
    expect(contenidoCapturado("0", "MILILITRO").ok).toBe(false);
    expect(contenidoCapturado("abc", "GRAMO").ok).toBe(false);
  });
});

describe("textoContenido", () => {
  it("hereda el del producto y se calla a granel", () => {
    const coca = { unidad_medida: "PIEZA", contenido_cantidad: null, contenido_unidad: null };
    expect(textoContenido(coca, { contenido_cantidad: 2.5, contenido_unidad: "LITRO" })).toBe("2.5 L");
    expect(textoContenido({ unidad_medida: "PIEZA", contenido_cantidad: 45, contenido_unidad: "GRAMO" })).toBe("45 g");
    expect(textoContenido({ unidad_medida: "KG", contenido_cantidad: 1, contenido_unidad: "KG" })).toBe("");
    expect(
      textoContenido(coca, { unidad_medida: "LITRO", contenido_cantidad: 2.5, contenido_unidad: "LITRO" })
    ).toBe("");
    expect(textoContenido(coca)).toBe("");
  });
});
