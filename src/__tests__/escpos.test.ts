import { describe, expect, it } from "vitest";
import {
  TicketEscPos,
  codificar,
  columnas,
  izquierdaDerecha,
  partir,
} from "@/features/pos/impresora/escpos";

describe("ESC/POS", () => {
  it("empieza con iniciar y pagina de codigos PC850", () => {
    const bytes = new TicketEscPos(58).resultado();
    expect(Array.from(bytes.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x02]);
  });

  it("acentos y ñ en PC850; lo desconocido sin acento o '?'", () => {
    expect(codificar("áéíóú ñÑ ¿¡")).toEqual([0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0x20, 0xa4, 0xa5, 0x20, 0xa8, 0xad]);
    expect(codificar("ç")).toEqual([0x63]);
    expect(codificar("—")).toEqual([0x3f]);
    expect(codificar("Hola 1")).toEqual(Array.from("Hola 1").map((c) => c.charCodeAt(0)));
  });

  it("alinear, negritas y cortar", () => {
    const b = Array.from(new TicketEscPos(80).alinear("centro").negritas(true).cortar().resultado());
    expect(b).toEqual(expect.arrayContaining([0x1b, 0x61, 1, 0x1b, 0x45, 1]));
    expect(b.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it("parte por palabras y corta palabras mas largas que el renglon", () => {
    expect(partir("Tortillas de maiz de un kilo", 12)).toEqual(["Tortillas de", "maiz de un", "kilo"]);
    expect(partir("ABCDEFGHIJKLMNOP", 5)).toEqual(["ABCDE", "FGHIJ", "KLMNO", "P"]);
  });

  it("columnas e izquierda/derecha miden exactamente el ancho", () => {
    const r = columnas(["x2 pza", "40.00/pza", "80.00"], [0, 11, 10], 32);
    expect(r).toHaveLength(32);
    expect(r.endsWith("80.00")).toBe(true);
    const f = izquierdaDerecha("Total $", "1250.00", 32);
    expect(f).toHaveLength(32);
    expect(f.startsWith("Total $")).toBe(true);
  });
});
