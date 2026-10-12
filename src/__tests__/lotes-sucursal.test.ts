import { describe, expect, it } from "vitest";
import {
  diasParaCaducar,
  estadoCaducidad,
  estaVencido,
  existenciaEn,
  hoyMx,
  ordenFefo,
  previsualizarTraspaso,
  vendibleConLotes,
  type LoteFefo,
} from "@/features/inventory/lotes";

const HOY = "2026-10-12";

function lote(numero: string, cad: string | null, cantidad: number, creado = "2026-01-01T00:00:00Z"): LoteFefo {
  return { id: numero, numero_lote: numero, fecha_caducidad: cad, creado_en: creado, cantidad };
}

describe("caducidad", () => {
  it("cuenta dias de calendario", () => {
    expect(diasParaCaducar("2026-10-12", HOY)).toBe(0);
    expect(diasParaCaducar("2026-10-13", HOY)).toBe(1);
    expect(diasParaCaducar("2026-10-11", HOY)).toBe(-1);
    expect(diasParaCaducar(null, HOY)).toBeNull();
  });

  it("caduca hoy todavia se vende; ayer no (misma regla que el servidor)", () => {
    expect(estaVencido("2026-10-12", HOY)).toBe(false);
    expect(estaVencido("2026-10-11", HOY)).toBe(true);
    expect(estaVencido(null, HOY)).toBe(false);
  });

  it("clasifica el estado", () => {
    expect(estadoCaducidad("2026-10-01", HOY)).toBe("vencido");
    expect(estadoCaducidad("2026-10-15", HOY)).toBe("critico");
    expect(estadoCaducidad("2026-11-01", HOY)).toBe("pronto");
    expect(estadoCaducidad("2027-01-01", HOY)).toBe("vigente");
    expect(estadoCaducidad(null, HOY)).toBeNull();
  });

  it("hoyMx usa la zona de Mexico", () => {
    // 2026-10-12 03:00 UTC = 2026-10-11 21:00 en CDMX
    expect(hoyMx(new Date("2026-10-12T03:00:00Z"))).toBe("2026-10-11");
  });
});

describe("existencias", () => {
  const ex = [
    { sucursal_id: "casa", cantidad: 4 },
    { sucursal_id: "maleta", cantidad: 2.5 },
  ];
  it("suma una sucursal o todas", () => {
    expect(existenciaEn(ex, "casa")).toBe(4);
    expect(existenciaEn(ex, null)).toBe(6.5);
    expect(existenciaEn(ex, "otra")).toBe(0);
    expect(existenciaEn(undefined, null)).toBe(0);
  });
});

describe("FEFO", () => {
  it("ordena por caducidad, sin fecha al final, luego antiguedad", () => {
    const orden = ordenFefo([
      lote("SIN", null, 1),
      lote("B", "2026-12-01", 1),
      lote("A2", "2026-11-01", 1, "2026-02-01T00:00:00Z"),
      lote("A1", "2026-11-01", 1, "2026-01-01T00:00:00Z"),
    ]).map((l) => l.numero_lote);
    expect(orden).toEqual(["A1", "A2", "B", "SIN"]);
  });

  it("traspaso: vigentes FEFO, luego sin lote, al final caducados", () => {
    const lotes = [lote("VIEJO", "2026-10-01", 2), lote("A", "2026-11-11", 10), lote("B", "2026-10-22", 5)];
    // stock 18 = 17 en lotes + 1 sin lote
    expect(previsualizarTraspaso(lotes, 18, 6, HOY)).toEqual({
      lotes: [
        { numero_lote: "B", fecha_caducidad: "2026-10-22", cantidad: 5, vencido: false },
        { numero_lote: "A", fecha_caducidad: "2026-11-11", cantidad: 1, vencido: false },
      ],
      sinLote: 0,
    });
    const todo = previsualizarTraspaso(lotes, 18, 18, HOY);
    expect(todo.sinLote).toBe(1);
    expect(todo.lotes.map((t) => [t.numero_lote, t.cantidad, t.vencido])).toEqual([
      ["B", 5, false],
      ["A", 10, false],
      ["VIEJO", 2, true],
    ]);
  });

  it("vendible descuenta lo caducado", () => {
    const lotes = [lote("VIEJO", "2026-10-01", 2), lote("A", "2026-11-11", 10)];
    expect(vendibleConLotes(12, lotes, HOY)).toBe(10);
    expect(vendibleConLotes(1, lotes, HOY)).toBe(0);
  });
});
