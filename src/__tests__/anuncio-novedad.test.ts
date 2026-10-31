import { describe, expect, it } from "vitest";
import { claveCorreoNovedad, elegirDestinatarios, type CandidatoNovedad } from "@/lib/anuncio-novedad";
import { construirCorreoNovedadCatalogo } from "@/lib/email";

const base: CandidatoNovedad = {
  tenantId: "t1",
  negocio: "Ferretería El Tornillo",
  esDemo: false,
  acceso: "completo",
  tieneCatalogo: false,
  userId: "u1",
  email: "dueno@ejemplo.mx",
  meta: { nombre: "Luis Pérez" },
  appMeta: {},
};

describe("destinatarios del anuncio de novedad", () => {
  it("le llega al dueño de un negocio activo, con su primer nombre", () => {
    const { destinatarios } = elegirDestinatarios([base]);
    expect(destinatarios).toEqual([
      { tenantId: "t1", userId: "u1", to: "dueno@ejemplo.mx", nombre: "Luis", negocio: "Ferretería El Tornillo" },
    ]);
  });

  it("en gracia también: todavía puede usarlo", () => {
    expect(elegirDestinatarios([{ ...base, acceso: "gracia" }]).destinatarios).toHaveLength(1);
  });

  it("deja fuera demos, solo lectura, quien ya tiene catálogo y quien no tiene correo", () => {
    const { destinatarios, excluidos } = elegirDestinatarios([
      { ...base, tenantId: "a", negocio: "A", esDemo: true },
      { ...base, tenantId: "b", negocio: "B", userId: "u2", appMeta: { is_demo: true } },
      { ...base, tenantId: "c", negocio: "C", userId: "u3", acceso: "solo_lectura" },
      { ...base, tenantId: "d", negocio: "D", userId: "u4", tieneCatalogo: true },
      { ...base, tenantId: "e", negocio: "E", userId: "u5", email: null },
    ]);
    expect(destinatarios).toEqual([]);
    expect(excluidos.map((e) => e.motivo)).toEqual([
      "demo",
      "demo",
      "solo_lectura",
      "ya_tiene_catalogo",
      "sin_correo",
    ]);
  });

  it("un correo por persona aunque tenga varios negocios", () => {
    const { destinatarios, excluidos } = elegirDestinatarios([
      { ...base, tenantId: "t2", negocio: "Zapatería" },
      { ...base, tenantId: "t1", negocio: "Abarrotes" },
    ]);
    expect(destinatarios.map((d) => d.negocio)).toEqual(["Abarrotes"]);
    expect(excluidos).toEqual([{ negocio: "Zapatería", motivo: "repetido" }]);
  });

  it("la clave de envío es por novedad y persona", () => {
    expect(claveCorreoNovedad("catalogo-en-linea", "u1")).toBe("novedad-correo:catalogo-en-linea:u1");
  });
});

describe("correo de la novedad", () => {
  it("escapa el nombre del negocio y lleva al módulo", () => {
    const { subject, html } = construirCorreoNovedadCatalogo({ nombre: "Ana", negocio: "<b>Tienda</b>" });
    expect(subject).toBe("Nuevo en SYMVORA: tu catálogo en línea");
    expect(html).toContain("&lt;b&gt;Tienda&lt;/b&gt;");
    expect(html).not.toContain("<b>Tienda</b>");
    expect(html).toContain("https://app.symvora.com.mx/es/online-catalog");
    expect(html).toContain("Hola, Ana");
  });
});
