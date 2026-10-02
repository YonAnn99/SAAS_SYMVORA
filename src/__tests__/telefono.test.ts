import { describe, expect, it } from "vitest";
import { aE164, desdeE164, formatearTelefono, numeroNacional } from "@/lib/telefono";

describe("aE164", () => {
  it("un celular de México de 10 dígitos toma el +52", () => {
    expect(aE164("MX", "5512345678")).toBe("+525512345678");
  });

  it("ignora espacios, guiones y paréntesis", () => {
    expect(aE164("MX", "(55) 1234-5678")).toBe("+525512345678");
    expect(aE164("MX", "55 1234 5678")).toBe("+525512345678");
  });

  it("acepta el número completo pegado con su lada", () => {
    expect(aE164("MX", "+52 55 1234 5678")).toBe("+525512345678");
  });

  it("quita el 1 viejo de los celulares de México", () => {
    expect(aE164("MX", "+52 1 55 1234 5678")).toBe("+525512345678");
  });

  it("rechaza un número incompleto o de más", () => {
    expect(aE164("MX", "551234567")).toBeNull();
    expect(aE164("MX", "55123456789")).toBeNull();
    expect(aE164("MX", "")).toBeNull();
  });

  it("usa la lada del país elegido, también para los que comparten +1", () => {
    expect(aE164("US", "212 555 0100")).toBe("+12125550100");
    expect(aE164("CA", "416 555 0100")).toBe("+14165550100");
    expect(aE164("GT", "5123 4567")).toBe("+50251234567");
  });

  it("quita el 0 de marcación nacional", () => {
    expect(numeroNacional("PE", "0987654321")).toBe("987654321");
  });
});

describe("desdeE164", () => {
  it("separa país y número para volver a editarlo", () => {
    expect(desdeE164("+525512345678")).toEqual({ pais: "MX", numero: "5512345678" });
  });

  it("respeta el país guardado cuando la lada es compartida", () => {
    expect(desdeE164("+14165550100", "CA")).toEqual({ pais: "CA", numero: "4165550100" });
  });

  it("sin número devuelve México vacío", () => {
    expect(desdeE164(null)).toEqual({ pais: "MX", numero: "" });
  });
});

describe("formatearTelefono", () => {
  it("agrupa un número de 10 dígitos", () => {
    expect(formatearTelefono("+525512345678")).toBe("+52 55 1234 5678");
  });
});
