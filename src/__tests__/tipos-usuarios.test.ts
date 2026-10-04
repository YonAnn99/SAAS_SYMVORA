import { describe, expect, it } from "vitest";
import { nombreDeClave, nombreVisible } from "@/features/users/tipos-usuarios";

describe("nombreVisible", () => {
  it("muestra el nombre si lo hay", () => {
    expect(nombreVisible("Ana Pérez", "ana@correo.com")).toBe("Ana Pérez");
  });

  it("sin nombre (o solo espacios) muestra el correo", () => {
    expect(nombreVisible(null, "ana@correo.com")).toBe("ana@correo.com");
    expect(nombreVisible("   ", "ana@correo.com")).toBe("ana@correo.com");
  });

  it("sin nada muestra N/A", () => {
    expect(nombreVisible(null, null)).toBe("N/A");
  });
});

describe("nombreDeClave", () => {
  it("une nombre y apellido", () => {
    expect(nombreDeClave({ nombre: "Ana", apellido: "Pérez" })).toBe("Ana Pérez");
  });

  it("el apellido es opcional", () => {
    expect(nombreDeClave({ nombre: "Ana", apellido: null })).toBe("Ana");
  });

  it("las claves viejas, sin nombre, regresan null", () => {
    expect(nombreDeClave({ nombre: null, apellido: null })).toBeNull();
  });
});
