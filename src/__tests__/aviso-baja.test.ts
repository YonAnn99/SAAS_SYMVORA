import { describe, expect, it } from "vitest";
import { construirAvisoBaja, esUltimoUsuario, etiquetaPersona } from "@/lib/aviso-baja";

const persona = { nombre: "Diego Andrade", correo: "diego@gmail.com", rol: "CAJERO" };
const base = {
  persona,
  negocio: "Farmacia avenida",
  miembros: 1,
  conservarContacto: false,
  motivo: "NO TRABAJO",
};

describe("aviso de solicitud de baja", () => {
  const solicitud = {
    ...base,
    tipo: "solicitud" as const,
    ejecutarEn: "2026-12-27T19:29:03Z",
  };

  it("dice quién lo pidió, su rol y el negocio", () => {
    const c = construirAvisoBaja(solicitud);
    expect(c.subject).toContain("Farmacia avenida");
    expect(c.subject).toContain("Diego Andrade");
    expect(c.text).toContain("Diego Andrade (diego@gmail.com)");
    expect(c.text).toContain("cajero");
    expect(c.text).toContain("Motivo: NO TRABAJO");
  });

  it("si es el único usuario del negocio, lo marca", () => {
    const c = construirAvisoBaja(solicitud);
    expect(c.text).toContain("ES EL ÚLTIMO USUARIO");
    expect(c.html).toContain("<strong>ES EL ÚLTIMO USUARIO");
  });

  it("con más de un usuario no lo marca", () => {
    const c = construirAvisoBaja({ ...solicitud, miembros: 3 });
    expect(c.text).not.toContain("ÚLTIMO USUARIO");
    expect(c.text).toContain("3 personas");
  });

  it("si lo pide el dueño dice que se borra el negocio completo", () => {
    const c = construirAvisoBaja({ ...solicitud, persona: { ...persona, rol: "SUPER_ADMIN" }, miembros: 4 });
    expect(c.text).toContain("El dueño");
    expect(c.text).toContain("Se borrará el negocio completo");
  });

  it("escapa el motivo en el HTML", () => {
    const c = construirAvisoBaja({ ...solicitud, motivo: "<img src=x> & \"hola\"" });
    expect(c.html).not.toContain("<img");
    expect(c.html).toContain("&lt;img src=x&gt; &amp; &quot;hola&quot;");
  });
});

describe("aviso de cancelación", () => {
  const cancelacion = {
    ...base,
    tipo: "cancelacion" as const,
    solicitadaEn: "2026-11-27T19:29:03Z",
    canceladaEn: "2026-11-27T19:45:03Z",
  };

  it("usa su propio asunto y dice cuánto tardó en cancelarla", () => {
    const c = construirAvisoBaja(cancelacion);
    expect(c.subject.startsWith("Canceló su solicitud")).toBe(true);
    expect(c.text).toContain("16 minutos después");
    expect(c.text).toContain("Ya no se borra nada");
    expect(c.text).not.toContain("Se ejecuta el");
  });
});

describe("helpers", () => {
  it("etiqueta la persona con lo que haya", () => {
    expect(etiquetaPersona({ nombre: null, correo: "a@b.mx", rol: null })).toBe("a@b.mx");
    expect(etiquetaPersona({ nombre: "Ana", correo: null, rol: null })).toBe("Ana");
    expect(etiquetaPersona({ nombre: null, correo: null, rol: null })).toBe("sin correo");
  });

  it("el último usuario es el de 1 persona o menos", () => {
    expect(esUltimoUsuario(1)).toBe(true);
    expect(esUltimoUsuario(2)).toBe(false);
  });
});
