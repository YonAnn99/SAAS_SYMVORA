import { describe, expect, it } from "vitest";
import {
  etiquetaDeClave,
  normalizarDetalles,
} from "@/features/activity/format-details";

/** Atajo: los pares en forma "Etiqueta: valor" para comparar cómodo. */
function pares(details: unknown): string[] {
  const r = normalizarDetalles(details);
  return r.tipo === "pares" ? r.pares.map((p) => `${p.etiqueta}: ${p.valor}`) : [];
}

describe("caso normal: un objeto", () => {
  it("produce sus pares clave/valor con la etiqueta legible", () => {
    expect(pares({ fondo_inicial: 300 })).toEqual(["Fondo Inicial: 300"]);
  });

  it("filtra las claves internas del trigger", () => {
    // `operation` y `table` las pone `log_table_changes()`; no aportan nada.
    expect(pares({ table: "cajas", operation: "CREATE", monto: 50 })).toEqual([
      "Monto: 50",
    ]);
  });

  it("un objeto que solo trae claves internas queda vacío", () => {
    expect(normalizarDetalles({ table: "cajas", operation: "CREATE" }).tipo).toBe(
      "vacio"
    );
  });

  it("los booleanos se leen en español", () => {
    expect(pares({ activo: true, borrado: false })).toEqual([
      "Activo: Sí",
      "Borrado: No",
    ]);
  });
});

describe("EL BUG: una cadena JSON no se recorre carácter a carácter", () => {
  it("parsea el JSON doblemente encodeado", () => {
    // Esto es exactamente lo que había en las 40 filas rotas de producción.
    // Antes, `Object.entries` sobre esta cadena devolvía pares índice/carácter
    // y la columna salía como `0: { 1: " 2: f 3: o …`.
    expect(pares('{"fondo_inicial":300}')).toEqual(["Fondo Inicial: 300"]);
  });

  it("nunca devuelve claves numéricas, que era la señal del fallo", () => {
    const r = normalizarDetalles('{"nuevo_estado":"ENVIADA"}');
    expect(r.tipo).toBe("pares");
    if (r.tipo === "pares") {
      expect(r.pares.map((p) => p.clave)).toEqual(["nuevo_estado"]);
      for (const p of r.pares) {
        expect(/^\d+$/.test(p.clave), `clave numérica: ${p.clave}`).toBe(false);
      }
    }
  });

  it("caso real completo de la bitácora", () => {
    expect(pares('{"saldo_real":855,"saldo_esperado":855,"diferencia":0}')).toEqual([
      "Saldo Real: 855",
      "Saldo Esperado: 855",
      "Diferencia: 0",
    ]);
  });
});

describe("datos que no son un objeto degradan a texto legible", () => {
  it("texto plano se muestra entero", () => {
    const r = normalizarDetalles("se canceló a mano");
    expect(r).toEqual({ tipo: "texto", texto: "se canceló a mano" });
  });

  it("un JSON válido que no es objeto tampoco se descompone", () => {
    expect(normalizarDetalles("123")).toEqual({ tipo: "texto", texto: "123" });
    expect(normalizarDetalles("[1,2,3]")).toEqual({ tipo: "texto", texto: "[1,2,3]" });
  });

  it("un número o un booleano sueltos no revientan", () => {
    expect(normalizarDetalles(42)).toEqual({ tipo: "texto", texto: "42" });
    expect(normalizarDetalles(true)).toEqual({ tipo: "texto", texto: "true" });
  });
});

describe("vacíos", () => {
  it("null, undefined, objeto vacío y cadena vacía dan vacío", () => {
    for (const v of [null, undefined, {}, "", "   "]) {
      expect(normalizarDetalles(v).tipo, JSON.stringify(v)).toBe("vacio");
    }
  });
});

describe("etiquetaDeClave", () => {
  it("convierte snake_case en Título", () => {
    expect(etiquetaDeClave("fondo_inicial")).toBe("Fondo Inicial");
    expect(etiquetaDeClave("monto")).toBe("Monto");
  });
});
