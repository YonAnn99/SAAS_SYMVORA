import { describe, expect, it } from "vitest";
import { nombreCompleto, primerNombre } from "@/lib/nombre-usuario";

describe("nombreCompleto", () => {
  it("lee el nombre del registro (`nombre`)", () => {
    expect(nombreCompleto({ nombre: "Ana Sofía Pérez López" })).toBe(
      "Ana Sofía Pérez López"
    );
  });

  it("prefiere lo editado en Mi perfil sobre el registro y Google", () => {
    expect(
      nombreCompleto({
        nombre_completo: "Ana Pérez",
        nombre: "Ana Sofía Pérez López",
        full_name: "Ana P.",
      })
    ).toBe("Ana Pérez");
  });

  it("usa el de Google si no hay otro", () => {
    expect(nombreCompleto({ full_name: "Luis Gómez" })).toBe("Luis Gómez");
  });

  it("ignora vacíos, espacios y valores que no son texto", () => {
    expect(nombreCompleto({ nombre_completo: "   ", nombre: "Luis" })).toBe("Luis");
    expect(nombreCompleto({ nombre: 42 })).toBe("");
    expect(nombreCompleto(null)).toBe("");
    expect(nombreCompleto(undefined)).toBe("");
  });
});

describe("primerNombre", () => {
  it("regresa la primera palabra", () => {
    expect(primerNombre("  Ana   Sofía Pérez López")).toBe("Ana");
  });

  it("regresa vacío sin nombre", () => {
    expect(primerNombre("")).toBe("");
    expect(primerNombre(nombreCompleto({}))).toBe("");
  });
});
