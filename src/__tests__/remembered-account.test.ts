import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyRememberChoice,
  forgetRememberedEmail,
  loadRememberedEmail,
  rememberEmail,
} from "@/lib/auth/remembered-account";

describe("recordar cuenta", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sin nada guardado no hay correo que rellenar", () => {
    expect(loadRememberedEmail()).toBeNull();
  });

  it("guarda y recupera el correo", () => {
    rememberEmail("cajero@tienda.mx");
    expect(loadRememberedEmail()).toBe("cajero@tienda.mx");
  });

  it("recorta espacios al guardar", () => {
    // Al pegar el correo desde otro sitio suele colarse un espacio final.
    rememberEmail("  cajero@tienda.mx  ");
    expect(loadRememberedEmail()).toBe("cajero@tienda.mx");
  });

  it("ignora un valor guardado que no parezca un correo", () => {
    // Si otra cosa escribe basura en esa clave, rellenar el campo con ella
    // dejaría el formulario inválido sin que se entienda por qué.
    window.localStorage.setItem("symvora_remembered_email", "basura");
    expect(loadRememberedEmail()).toBeNull();
  });

  it("olvidar deja el campo vacío", () => {
    rememberEmail("cajero@tienda.mx");
    forgetRememberedEmail();
    expect(loadRememberedEmail()).toBeNull();
  });

  it("desmarcar el switch BORRA lo guardado antes, no solo deja de guardar", () => {
    // Este era el fallo de fondo: si desmarcar solo evitara escribir, el correo
    // viejo seguiría apareciendo y el switch parecería roto otra vez.
    rememberEmail("viejo@tienda.mx");
    applyRememberChoice("viejo@tienda.mx", false);
    expect(loadRememberedEmail()).toBeNull();
  });

  it("marcar el switch guarda el correo con el que se entró", () => {
    applyRememberChoice("nuevo@tienda.mx", true);
    expect(loadRememberedEmail()).toBe("nuevo@tienda.mx");
  });

  it("cambiar de cuenta sustituye el correo recordado", () => {
    applyRememberChoice("primero@tienda.mx", true);
    applyRememberChoice("segundo@tienda.mx", true);
    expect(loadRememberedEmail()).toBe("segundo@tienda.mx");
  });

  it("nunca guarda contraseñas ni tokens: solo una clave y solo el correo", () => {
    applyRememberChoice("cajero@tienda.mx", true);
    expect(Object.keys(window.localStorage)).toEqual(["symvora_remembered_email"]);
  });

  it("si localStorage lanza (modo privado) no rompe el login", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("acceso denegado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("acceso denegado");
    });
    expect(loadRememberedEmail()).toBeNull();
    expect(() => applyRememberChoice("cajero@tienda.mx", true)).not.toThrow();
  });
});
