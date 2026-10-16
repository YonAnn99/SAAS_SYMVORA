import { describe, expect, it } from "vitest";
import {
  armarNombre,
  edadDe,
  edadValida,
  nombreCompleto,
  partesDelNombre,
  primerNombre,
} from "@/lib/nombre-usuario";

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

describe("armarNombre", () => {
  it("une las partes sin espacios de más", () => {
    expect(
      armarNombre({ primerNombre: " Ana ", segundoNombre: "", apellidoPaterno: "Pérez", apellidoMaterno: "  " })
    ).toBe("Ana Pérez");
  });
});

describe("partesDelNombre (valores iniciales de Mi perfil)", () => {
  it("usa las partes guardadas si forman el nombre vigente", () => {
    expect(
      partesDelNombre({
        nombre: "María de la Luz Pérez",
        primer_nombre: "María",
        segundo_nombre: "de la Luz",
        apellido_paterno: "Pérez",
      })
    ).toEqual({ primerNombre: "María", segundoNombre: "de la Luz", apellidoPaterno: "Pérez", apellidoMaterno: "" });
  });

  it("ignora partes viejas si el dueño cambió el nombre desde Usuarios", () => {
    expect(
      partesDelNombre({
        nombre: "Luis Gómez Ruiz",
        nombre_completo: "Luis Gómez Ruiz",
        primer_nombre: "Juan",
        apellido_paterno: "Pérez",
      })
    ).toEqual({ primerNombre: "Luis", segundoNombre: "", apellidoPaterno: "Gómez", apellidoMaterno: "Ruiz" });
  });

  it("parte el nombre por palabras en cuentas sin partes", () => {
    const de = (nombre: string) => partesDelNombre({ nombre });
    expect(de("SYMVORA").primerNombre).toBe("SYMVORA");
    expect(de("Ana Pérez")).toMatchObject({ primerNombre: "Ana", apellidoPaterno: "Pérez", apellidoMaterno: "" });
    expect(de("Ana Sofía Pérez López")).toEqual({
      primerNombre: "Ana",
      segundoNombre: "Sofía",
      apellidoPaterno: "Pérez",
      apellidoMaterno: "López",
    });
    expect(de("José Luis Antonio Pérez López").segundoNombre).toBe("Luis Antonio");
    expect(partesDelNombre(null).primerNombre).toBe("");
  });
});

describe("edad", () => {
  it("acepta enteros de 18 a 120", () => {
    expect(edadValida(18)).toBe(true);
    expect(edadValida(120)).toBe(true);
    expect(edadValida(17)).toBe(false);
    expect(edadValida(30.5)).toBe(false);
  });

  it("lee la edad guardada o null", () => {
    expect(edadDe({ edad: 34 })).toBe(34);
    expect(edadDe({ edad: "34" })).toBe(34);
    expect(edadDe({ edad: null })).toBeNull();
    expect(edadDe({ edad: 200 })).toBeNull();
    expect(edadDe(undefined)).toBeNull();
  });
});
