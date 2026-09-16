import { describe, expect, it } from "vitest";
import { normalizarTelefonoMx, urlWhatsApp } from "@/lib/whatsapp";
import { mensajeParaProveedor } from "@/features/inventory/purchase-order-message";

describe("normalizarTelefonoMx", () => {
  it("un nacional de 10 dígitos toma la lada de México", () => {
    // Es el formato real de `proveedores.telefono` en producción.
    expect(normalizarTelefonoMx("5555567678")).toBe("525555567678");
  });

  it("ignora espacios, guiones y paréntesis", () => {
    // La columna es TEXT libre sin validación: llega de todo.
    expect(normalizarTelefonoMx("(55) 5556-7678")).toBe("525555567678");
    expect(normalizarTelefonoMx("55 5556 7678")).toBe("525555567678");
  });

  it("no duplica la lada si ya viene", () => {
    expect(normalizarTelefonoMx("+52 55 5556 7678")).toBe("525555567678");
    expect(normalizarTelefonoMx("525555567678")).toBe("525555567678");
  });

  it("quita el 1 de móvil que arrastran las agendas viejas", () => {
    expect(normalizarTelefonoMx("+521 55 5556 7678")).toBe("525555567678");
  });

  it("devuelve null cuando no se puede salvar", () => {
    // Y eso importa: con null el botón no se pinta. Un número adivinado
    // abriría el chat de un desconocido, que es peor que no ofrecer el botón.
    for (const v of [null, undefined, "", "   ", "12345", "no tiene", "+1 415 555 0100"]) {
      expect(normalizarTelefonoMx(v), `${v}`).toBeNull();
    }
  });
});

describe("urlWhatsApp", () => {
  it("escapa el mensaje", () => {
    // Sin escapar, un "&" o un salto de línea cortarían la URL.
    const url = urlWhatsApp("525555567678", "Hola & adiós\nsegunda línea");
    expect(url).toContain("https://wa.me/525555567678?text=");
    expect(url).not.toContain("&adi");
    expect(url).toContain("%26");
    expect(url).toContain("%0A");
  });
});

describe("mensajeParaProveedor", () => {
  const datos = {
    numeroOrden: "OC-007",
    proveedor: "Diego",
    negocio: "Pruebas SYMVORA",
    lineas: [
      { nombre: "Café", cantidad: 2, costo_unitario: 30 },
      { nombre: "Azúcar", cantidad: 1.5, costo_unitario: 20 },
    ],
    total: 116,
    fechaEstimada: null,
  };

  it("lleva el pedido completo", () => {
    const m = mensajeParaProveedor(datos);
    expect(m).toContain("Diego");
    expect(m).toContain("OC-007");
    expect(m).toContain("Pruebas SYMVORA");
    expect(m).toContain("Café");
    expect(m).toContain("Azúcar");
  });

  it("las cantidades enteras salen sin decimales", () => {
    // "2 x Café" se lee mejor que "2.000 x Café"; los decimales de verdad se
    // conservan.
    const m = mensajeParaProveedor(datos);
    expect(m).toContain("2 x Café");
    expect(m).toContain("1.5 x Azúcar");
  });

  it("sin nombre de proveedor no deja un 'Hola ,' colgando", () => {
    const m = mensajeParaProveedor({ ...datos, proveedor: "" });
    expect(m).not.toContain("Hola ,");
    expect(m.startsWith("Hola.")).toBe(true);
  });

  it("la fecha estimada solo aparece si existe", () => {
    expect(mensajeParaProveedor(datos)).not.toContain("Fecha estimada");
    expect(
      mensajeParaProveedor({ ...datos, fechaEstimada: "2026-10-01" })
    ).toContain("Fecha estimada");
  });

  it("no usa Markdown de dos asteriscos", () => {
    // WhatsApp usa UN asterisco para negrita; "**texto**" llegaría literal.
    expect(mensajeParaProveedor(datos)).not.toContain("**");
  });
});
