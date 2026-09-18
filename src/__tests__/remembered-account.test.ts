import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyRememberChoice,
  forgetRememberedEmail,
  loadRememberedEmail,
  rememberEmail,
  CLAVES_RECORDADAS,
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

/**
 * El acceso con clave (cajeros y colaboradores) tiene su propio "Recordarme".
 *
 * El fallo que previenen estos test: con un único hueco compartido, en un
 * mostrador donde alternan el dueño y el cajero, cada uno le borraba el correo
 * recordado al otro — y el correo del cajero acababa prerrellenado en el
 * formulario de contraseña, que es donde no le sirve de nada.
 */
describe("recordar cuenta: dos ámbitos", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sin indicar ámbito se usa el del login normal", () => {
    // Retrocompatibilidad: las llamadas que ya existían no cambiaron.
    rememberEmail("dueno@tienda.mx");
    expect(loadRememberedEmail("password")).toBe("dueno@tienda.mx");
  });

  it("cada formulario recuerda su propio correo", () => {
    rememberEmail("dueno@tienda.mx", "password");
    rememberEmail("cajero@tienda.mx", "clave");
    expect(loadRememberedEmail("password")).toBe("dueno@tienda.mx");
    expect(loadRememberedEmail("clave")).toBe("cajero@tienda.mx");
  });

  it("guardar en uno no toca el otro", () => {
    rememberEmail("dueno@tienda.mx", "password");
    rememberEmail("cajero@tienda.mx", "clave");
    rememberEmail("otro@tienda.mx", "clave");
    expect(loadRememberedEmail("password")).toBe("dueno@tienda.mx");
  });

  it("el cajero apagando su switch NO borra el correo del dueño", () => {
    // El escenario del mostrador compartido. Con un hueco único, este
    // `applyRememberChoice(_, false)` se llevaba por delante al dueño.
    applyRememberChoice("dueno@tienda.mx", true, "password");
    applyRememberChoice("cajero@tienda.mx", false, "clave");
    expect(loadRememberedEmail("password")).toBe("dueno@tienda.mx");
    expect(loadRememberedEmail("clave")).toBeNull();
  });

  it("olvidar uno no olvida el otro", () => {
    rememberEmail("dueno@tienda.mx", "password");
    rememberEmail("cajero@tienda.mx", "clave");
    forgetRememberedEmail("clave");
    expect(loadRememberedEmail("password")).toBe("dueno@tienda.mx");
    expect(loadRememberedEmail("clave")).toBeNull();
  });

  it("con los dos ámbitos usados solo existen esas dos claves", () => {
    // Amplía el guardián anterior al ámbito nuevo: aquí no puede colarse una
    // clave de invitación, una contraseña ni un token.
    applyRememberChoice("dueno@tienda.mx", true, "password");
    applyRememberChoice("cajero@tienda.mx", true, "clave");
    const guardadas = Object.keys(window.localStorage);
    expect(guardadas.sort()).toEqual([...CLAVES_RECORDADAS].sort());
  });

  it("todo lo guardado parece un correo, nunca un secreto", () => {
    applyRememberChoice("dueno@tienda.mx", true, "password");
    applyRememberChoice("cajero@tienda.mx", true, "clave");
    for (const clave of Object.keys(window.localStorage)) {
      expect(window.localStorage.getItem(clave)).toContain("@");
    }
  });

  it("una clave de invitación guardada por error no se prerrellena", () => {
    // Defensa en profundidad: aunque algo escribiera "ABC123XY" bajo esa clave,
    // no acabaría en un campo de inicio de sesión.
    window.localStorage.setItem("symvora_remembered_key_email", "ABC123XY");
    expect(loadRememberedEmail("clave")).toBeNull();
  });
});
