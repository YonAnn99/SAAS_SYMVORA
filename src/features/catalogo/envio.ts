import { formatearPrecio } from "./pedido";
import type { Moneda } from "@/lib/money";

/**
 * Costo de envío a domicilio de los pedidos del catálogo (migración 144). Lo fija el admin en Catálogo en línea →
 * Personalizar y se COPIA al pedido al crearlo (el cliente conserva el que vio).
 *
 *   null = el negocio confirma el costo · 0 = envío gratis · n = costo.
 *
 * El envío NO entra a la venta (el motor de ventas solo conoce productos): se muestra aparte y el negocio lo cobra
 * por su cuenta. El catálogo público va siempre en español.
 */

export const COSTO_ENVIO_MAX = 99999;

/** Un monto válido para el envío: 0–99,999 con a lo sumo 2 decimales. */
export function costoEnvioValido(valor: unknown): valor is number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return false;
  if (valor < 0 || valor > COSTO_ENVIO_MAX) return false;
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

/** Lo que teclea el admin («30», «30.50», «» ) → número, null (vacío) o undefined (inválido). */
export function leerCostoEnvio(texto: string): number | null | undefined {
  const limpio = texto.trim().replace(/[$\s,]/g, "");
  if (limpio === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return undefined;
  const n = Number(limpio);
  return costoEnvioValido(n) ? n : undefined;
}

/** Normaliza lo que llega de la base (numeric viene como número o texto; ausente = sin costo definido). */
export function costoEnvioDeBase(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return costoEnvioValido(n) ? n : null;
}

/** La línea que ve el cliente al elegir «A domicilio». */
export function textoEnvio(costo: number | null | undefined, moneda: Moneda = "MXN"): string {
  const c = costoEnvioDeBase(costo);
  if (c === null) return "El negocio te confirma el costo del envío.";
  if (c === 0) return "Envío gratis.";
  return `Envío a domicilio: ${formatearPrecio(c, moneda)}.`;
}

/** Total que pagará el cliente: productos + envío. Sin precios (null) no hay total; sin costo, solo los productos. */
export function totalConEnvio(total: number | null, costo: number | null | undefined): number | null {
  if (total === null) return null;
  const c = costoEnvioDeBase(costo);
  return Math.round((total + (c ?? 0)) * 100) / 100;
}
