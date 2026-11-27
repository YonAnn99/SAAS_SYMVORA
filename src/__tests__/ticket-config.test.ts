import { describe, expect, it } from "vitest";
import {
  LIMITES_TICKET,
  TICKET_CONFIG_DEFAULT,
  limpiarTexto,
  normalizarTicketConfig,
  puedeQuitarMarcaTicket,
  ticketConfigEfectiva,
} from "@/features/pos/ticket-config";

describe("normalizarTicketConfig", () => {
  it("sin configuración guardada devuelve exactamente el ticket de siempre", () => {
    expect(normalizarTicketConfig(undefined)).toEqual(TICKET_CONFIG_DEFAULT);
    expect(normalizarTicketConfig(null)).toEqual(TICKET_CONFIG_DEFAULT);
    expect(normalizarTicketConfig("basura")).toEqual(TICKET_CONFIG_DEFAULT);
  });

  it("ignora tipos inválidos y conserva lo válido", () => {
    const c = normalizarTicketConfig({ mostrarLogo: "sí", mostrarCajero: false, telefono: 55 });
    expect(c.mostrarLogo).toBe(true);
    expect(c.mostrarCajero).toBe(false);
    expect(c.telefono).toBe("");
  });

  it("recorta cada campo a su tope", () => {
    const c = normalizarTicketConfig({
      telefono: "1".repeat(50),
      lineaExtra: "x".repeat(200),
      redes: "y".repeat(200),
      mensajePie: "z".repeat(900),
    });
    expect(c.telefono).toHaveLength(LIMITES_TICKET.telefono);
    expect(c.lineaExtra).toHaveLength(LIMITES_TICKET.lineaExtra);
    expect(c.redes).toHaveLength(LIMITES_TICKET.redes);
    expect(c.mensajePie).toHaveLength(LIMITES_TICKET.mensajePie);
  });
});

describe("limpiarTexto", () => {
  it("quita caracteres de control y espacios de los extremos", () => {
    expect(limpiarTexto("  hola\u0007 mundo \n ", 50)).toBe("hola mundo");
  });

  it("en una sola línea convierte los saltos en nada, no en renglones", () => {
    expect(limpiarTexto("uno\ndos", 50)).toBe("unodos");
  });

  it("en varias líneas conserva máximo 3 renglones", () => {
    expect(limpiarTexto("a\nb\nc\nd\ne", 200, true)).toBe("a\nb\nc");
  });

  it("no parte un carácter con varias unidades de código", () => {
    expect(limpiarTexto("ñandú🙂🙂", 6)).toBe("ñandú🙂");
  });
});

describe("marca «Generado con SYMVORA»", () => {
  it("Básico no puede quitarla; Pro, Premium y heredado sí", () => {
    expect(puedeQuitarMarcaTicket({ nivel: "basico" })).toBe(false);
    expect(puedeQuitarMarcaTicket({ nivel: "pro" })).toBe(true);
    expect(puedeQuitarMarcaTicket({ nivel: "premium" })).toBe(true);
    expect(puedeQuitarMarcaTicket({ nivel: null })).toBe(true);
  });

  it("en Básico se fuerza a mostrarse aunque el negocio la haya ocultado", () => {
    const guardada = { ...TICKET_CONFIG_DEFAULT, ocultarMarca: true };
    expect(ticketConfigEfectiva(guardada, false).ocultarMarca).toBe(false);
    // La configuración guardada no cambia: si vuelve a subir de nivel, la marca sigue oculta.
    expect(guardada.ocultarMarca).toBe(true);
    expect(ticketConfigEfectiva(guardada, true).ocultarMarca).toBe(true);
  });
});
