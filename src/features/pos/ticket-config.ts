/**
 * Personalización del ticket de venta (pestaña «Ticket» de Configuración).
 *
 * Lógica pura: lo que se guarda, lo que se muestra y lo que sale en papel salen de aquí, así que el
 * ticket en pantalla, el impreso y la vista previa no pueden divergir.
 *
 * Reglas:
 * - Sin `ticket_config` en el negocio, el ticket sale EXACTAMENTE como antes (`TICKET_CONFIG_DEFAULT`).
 * - «Generado con SYMVORA» es obligatorio en Básico. En Pro y Premium se puede quitar. Si un negocio baja
 *   de nivel, su configuración NO se borra: solo se fuerza la marca al mostrar e imprimir.
 * - «SIN VALIDEZ FISCAL», el nombre del negocio, productos, totales y los distintivos de reimpresión y
 *   venta cancelada NO son configurables.
 */

import type { FuncionesPlan } from "@/lib/niveles";
import type { TicketConfig } from "@/lib/types/database";

export type { TicketConfig };

export const TICKET_CONFIG_DEFAULT: TicketConfig = {
  mostrarLogo: true,
  telefono: "",
  lineaExtra: "",
  mostrarDireccion: true,
  mensajePie: "",
  redes: "",
  mostrarOperacion: true,
  mostrarCajero: true,
  mostrarCliente: true,
  mostrarCantidadItems: true,
  ocultarMarca: false,
};

/** Topes de largo. Se aplican al leer y al guardar. */
export const LIMITES_TICKET = {
  telefono: 20,
  lineaExtra: 60,
  mensajePie: 200,
  mensajePieLineas: 3,
  redes: 60,
} as const;

/**
 * Quita caracteres de control y recorta. Sin `multilinea` se queda en un solo renglón; con ella
 * conserva los saltos de línea (máximo `mensajePieLineas`).
 */
export function limpiarTexto(valor: unknown, max: number, multilinea = false): string {
  if (typeof valor !== "string") return "";
  const sinControl = valor.replace(
    multilinea ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g,
    ""
  );
  let texto: string;
  if (multilinea) {
    texto = sinControl
      .split("\n")
      .slice(0, LIMITES_TICKET.mensajePieLineas)
      .map((renglon) => renglon.trimEnd())
      .join("\n")
      .trim();
  } else {
    texto = sinControl.trim();
  }
  // Array.from para no partir un carácter con dos unidades de código (emoji, acentos compuestos).
  return Array.from(texto).slice(0, max).join("");
}

const booleano = (valor: unknown, defecto: boolean): boolean =>
  typeof valor === "boolean" ? valor : defecto;

/** Convierte lo guardado en el negocio en una configuración completa y segura. */
export function normalizarTicketConfig(json: unknown): TicketConfig {
  const j = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const d = TICKET_CONFIG_DEFAULT;
  return {
    mostrarLogo: booleano(j.mostrarLogo, d.mostrarLogo),
    telefono: limpiarTexto(j.telefono, LIMITES_TICKET.telefono),
    lineaExtra: limpiarTexto(j.lineaExtra, LIMITES_TICKET.lineaExtra),
    mostrarDireccion: booleano(j.mostrarDireccion, d.mostrarDireccion),
    mensajePie: limpiarTexto(j.mensajePie, LIMITES_TICKET.mensajePie, true),
    redes: limpiarTexto(j.redes, LIMITES_TICKET.redes),
    mostrarOperacion: booleano(j.mostrarOperacion, d.mostrarOperacion),
    mostrarCajero: booleano(j.mostrarCajero, d.mostrarCajero),
    mostrarCliente: booleano(j.mostrarCliente, d.mostrarCliente),
    mostrarCantidadItems: booleano(j.mostrarCantidadItems, d.mostrarCantidadItems),
    ocultarMarca: booleano(j.ocultarMarca, d.ocultarMarca),
  };
}

/** Quitar la marca es función de Pro y Premium. Sin nivel (heredado) también se permite. */
export function puedeQuitarMarcaTicket(funciones: Pick<FuncionesPlan, "nivel">): boolean {
  return funciones.nivel !== "basico";
}

/** Lo que de verdad se muestra e imprime: si el plan no permite quitar la marca, vuelve a salir. */
export function ticketConfigEfectiva(config: TicketConfig, puedeQuitarMarca: boolean): TicketConfig {
  return puedeQuitarMarca ? config : { ...config, ocultarMarca: false };
}
