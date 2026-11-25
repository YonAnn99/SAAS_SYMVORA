import { describe, expect, it } from "vitest";
import {
  COSTO_ENVIO_MAX,
  costoEnvioDeBase,
  costoEnvioValido,
  leerCostoEnvio,
  textoEnvio,
  totalConEnvio,
} from "@/features/catalogo/envio";

describe("costo de envío del catálogo", () => {
  it("valida 0–99,999 con a lo sumo 2 decimales", () => {
    for (const v of [0, 30, 30.5, 99.99, COSTO_ENVIO_MAX]) expect(costoEnvioValido(v)).toBe(true);
    for (const v of [-1, 100000, 1.234, NaN, Infinity, "30", null, undefined]) expect(costoEnvioValido(v)).toBe(false);
  });

  it("lee lo que teclea el admin: vacío = sin costo, inválido = undefined", () => {
    expect(leerCostoEnvio("")).toBeNull();
    expect(leerCostoEnvio("   ")).toBeNull();
    expect(leerCostoEnvio("30")).toBe(30);
    expect(leerCostoEnvio("$ 1,250.50")).toBe(1250.5);
    expect(leerCostoEnvio("0")).toBe(0);
    expect(leerCostoEnvio("-5")).toBeUndefined();
    expect(leerCostoEnvio("abc")).toBeUndefined();
    expect(leerCostoEnvio("12.345")).toBeUndefined();
    expect(leerCostoEnvio("100000")).toBeUndefined();
  });

  it("normaliza lo que llega de la base (numeric puede venir como texto)", () => {
    expect(costoEnvioDeBase("30.00")).toBe(30);
    expect(costoEnvioDeBase(0)).toBe(0);
    expect(costoEnvioDeBase(null)).toBeNull();
    expect(costoEnvioDeBase(undefined)).toBeNull();
    expect(costoEnvioDeBase("")).toBeNull();
    expect(costoEnvioDeBase("basura")).toBeNull();
  });

  it("el texto que ve el cliente", () => {
    expect(textoEnvio(null)).toBe("El negocio te confirma el costo del envío.");
    expect(textoEnvio(undefined)).toBe("El negocio te confirma el costo del envío.");
    expect(textoEnvio(0)).toBe("Envío gratis.");
    expect(textoEnvio(30)).toContain("30");
    expect(textoEnvio(30)).toContain("Envío a domicilio");
  });

  it("el total suma el envío solo si hay costo y hay precios", () => {
    expect(totalConEnvio(100, 30)).toBe(130);
    expect(totalConEnvio(100, 0)).toBe(100);
    expect(totalConEnvio(100, null)).toBe(100);
    expect(totalConEnvio(0.1 + 0.2, 0.1)).toBe(0.4);
    expect(totalConEnvio(null, 30)).toBeNull();
  });
});
