import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENTIMIENTO,
  DURACION_CONSENTIMIENTO,
  cookiesDeConsentimiento,
  leerConsentimiento,
} from "@/lib/consentimiento-cookies";

describe("leerConsentimiento", () => {
  it("sin cookie: sin decidir y con medicion (opt-out)", () => {
    expect(leerConsentimiento("")).toEqual({ decidido: false, medicion: true });
    expect(leerConsentimiento("NEXT_LOCALE=es; otra=1")).toEqual({ decidido: false, medicion: true });
  });

  it("el 'accepted' de la primera version cuenta como aceptar todo", () => {
    expect(leerConsentimiento("NEXT_LOCALE=es; symvora_consent=accepted")).toEqual({ decidido: true, medicion: true });
  });

  it("lee las elecciones de la version 2", () => {
    expect(leerConsentimiento("symvora_consent=v2:todas")).toEqual({ decidido: true, medicion: true });
    expect(leerConsentimiento("symvora_consent=v2:esenciales")).toEqual({ decidido: true, medicion: false });
  });

  it("si conviven la vieja del host y la nueva de dominio, manda la nueva", () => {
    expect(leerConsentimiento("symvora_consent=accepted; symvora_consent=v2:esenciales")).toEqual({
      decidido: true,
      medicion: false,
    });
  });

  it("un valor desconocido se trata como sin decidir", () => {
    expect(leerConsentimiento("symvora_consent=quien-sabe")).toEqual({ decidido: false, medicion: true });
  });
});

describe("cookiesDeConsentimiento", () => {
  it("en symvora.com.mx va a todo el dominio y borra la del host", () => {
    const [borrar, guardar] = cookiesDeConsentimiento(false, "www.symvora.com.mx");
    expect(borrar).toBe(`${COOKIE_CONSENTIMIENTO}=; path=/; max-age=0`);
    expect(guardar).toContain("symvora_consent=v2:esenciales");
    expect(guardar).toContain("domain=.symvora.com.mx");
    expect(guardar).toContain(`max-age=${DURACION_CONSENTIMIENTO}`);
    expect(guardar).toContain("samesite=lax");
  });

  it("en localhost, sin dominio", () => {
    const cookies = cookiesDeConsentimiento(true, "localhost");
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain("symvora_consent=v2:todas");
    expect(cookies[0]).not.toContain("domain=");
  });

  it("dura 180 dias", () => {
    expect(DURACION_CONSENTIMIENTO).toBe(180 * 24 * 60 * 60);
  });
});
