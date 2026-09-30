/**
 * Imprime un ticket de venta en la impresora conectada: arma los bytes
 * ESC/POS (con el logo, si carga) y los manda. Lanza si no se pudo, para que
 * el ticket ofrezca la ventana de impresion del navegador como respaldo.
 */

import type { SaleReceipt } from "../types/pos.types";
import { logoParaTicket } from "./logo-raster";
import { ticketPruebaEscPos, ticketVentaEscPos, type DatosNegocioTicket } from "./ticket-escpos";
import { imprimirBytes, type ConfigImpresora } from "./use-impresora";

export async function imprimirTicketVenta({
  config,
  receipt,
  negocio,
  metodoPagoTexto,
  logoUrl,
}: {
  config: ConfigImpresora;
  receipt: SaleReceipt;
  negocio: DatosNegocioTicket;
  metodoPagoTexto: string;
  logoUrl?: string | null;
}): Promise<void> {
  const logo = await logoParaTicket(logoUrl, config.ancho);
  const datos = ticketVentaEscPos({ receipt, negocio, ancho: config.ancho, metodoPagoTexto, logo });
  await imprimirBytes(datos);
}

export async function imprimirPrueba(config: ConfigImpresora, negocio: string): Promise<void> {
  await imprimirBytes(ticketPruebaEscPos(config.ancho, negocio));
}
