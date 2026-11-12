import { describe, expect, it } from "vitest";
import {
  CODE128_PATRONES,
  checksumCode128,
  digitoVerificadorEan13,
  dibujarCodigo,
  elegirCodigosLibres,
  esEan13Valido,
  generarCodigoInterno,
  modulosCode128,
  modulosEan13,
  simbologiaPara,
  valoresCode128,
} from "@/lib/codigo-barras";

describe("EAN-13", () => {
  it("calcula el digito verificador de codigos reales", () => {
    expect(digitoVerificadorEan13("750105530007")).toBe(5); // Coca-Cola 600 ml
    expect(digitoVerificadorEan13("400638133393")).toBe(1);
    expect(esEan13Valido("7501055300075")).toBe(true);
    expect(esEan13Valido("7501055300074")).toBe(false);
    // Los "750..." que generaba SYMVORA antes no traen verificador valido.
    expect(esEan13Valido("7500000000001")).toBe(false);
  });

  it("genera codigos internos 200 validos y distintos", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = generarCodigoInterno();
      expect(c).toMatch(/^200\d{10}$/);
      expect(esEan13Valido(c)).toBe(true);
      vistos.add(c);
    }
    expect(vistos.size).toBeGreaterThan(195);
  });

  it("mide 95 modulos con guardas y barras de la tabla", () => {
    const m = modulosEan13("7501055300075");
    expect(m).toHaveLength(95);
    expect(m.startsWith("101")).toBe(true);
    expect(m.slice(45, 50)).toBe("01010");
    expect(m.endsWith("101")).toBe(true);
    const dib = dibujarCodigo("7501055300075")!;
    expect(dib.simbologia).toBe("EAN13");
    // 3 guardas: 2 barras al inicio, 2 en medio, 2 al final.
    expect(dib.barras.filter((b) => b.guarda)).toHaveLength(6);
  });
});

describe("Code 128", () => {
  it("cada patron mide 11 modulos (el stop 13) y no se repite", () => {
    expect(CODE128_PATRONES).toHaveLength(107);
    CODE128_PATRONES.forEach((p, i) => {
      const suma = p.split("").reduce((a, n) => a + Number(n), 0);
      expect(suma).toBe(i === 106 ? 13 : 11);
    });
    expect(new Set(CODE128_PATRONES).size).toBe(107);
  });

  it("codifica texto en el juego B con su checksum", () => {
    const v = valoresCode128("PROD-01");
    // Start B, P R O D - 0 1
    expect(v).toEqual([104, 48, 50, 47, 36, 13, 16, 17]);
    expect(checksumCode128(v)).toBe(
      (104 + 48 * 1 + 50 * 2 + 47 * 3 + 36 * 4 + 13 * 5 + 16 * 6 + 17 * 7) % 103
    );
  });

  it("solo digitos: juego C por pares y el sobrante en B", () => {
    expect(valoresCode128("7500000000001")).toEqual([105, 75, 0, 0, 0, 0, 0, 100, 17]);
    expect(valoresCode128("123456")).toEqual([105, 12, 34, 56]);
  });

  it("modulos: inicio y fin correctos; ancho = 11 por simbolo + 13 del stop", () => {
    const m = modulosCode128("ABC");
    // Start B + 3 letras + checksum = 5 simbolos.
    expect(m).toHaveLength(5 * 11 + 13);
    expect(m.startsWith("11010010000")).toBe(true); // 211214
    expect(m.endsWith("1100011101011")).toBe(true); // stop
  });
});

describe("elegirCodigosLibres", () => {
  it("vuelve a sortear los que ya estan en uso", async () => {
    const secuencia = ["A", "B", "C", "D", "E"];
    let i = 0;
    const generar = () => secuencia[i++];
    const enUso = async (cods: string[]) => new Set(cods.filter((c) => c === "A" || c === "C"));
    const libres = await elegirCodigosLibres(2, enUso, generar);
    expect(libres.sort()).toEqual(["B", "D"]);
  });

  it("falla con un mensaje claro si nunca encuentra uno libre", async () => {
    let i = 0;
    await expect(
      elegirCodigosLibres(1, async (c) => new Set(c), () => String(i++), 3)
    ).rejects.toThrow(/código de barras libre/);
  });
});

describe("simbologiaPara / dibujarCodigo", () => {
  it("elige EAN-13 si es valido y Code 128 si no", () => {
    expect(simbologiaPara("2001234567893")).toBe(esEan13Valido("2001234567893") ? "EAN13" : "CODE128");
    expect(simbologiaPara(generarCodigoInterno())).toBe("EAN13");
    expect(simbologiaPara("7500000000001")).toBe("CODE128");
    expect(simbologiaPara("PROD-01")).toBe("CODE128");
    expect(simbologiaPara("Ñandú")).toBeNull();
    expect(dibujarCodigo("")).toBeNull();
    expect(dibujarCodigo(null)).toBeNull();
  });
});
