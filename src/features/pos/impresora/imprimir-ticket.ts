/**
 * Imprime un ticket de venta en la impresora conectada: arma los bytes
 * ESC/POS (con el logo, si carga) y los manda. Lanza si no se pudo, para que
 * el ticket ofrezca la ventana de impresion del navegador como respaldo.
 */

import type { SaleReceipt } from "../types/pos.types";
import { logoParaTicket } from "./logo-raster";
import { ticketPruebaEscPos, ticketVentaEscPos, type DatosNegocioTicket } from "./ticket-escpos";
import { imprimirBytes, type ConfigImpresora } from "./use-impresora";
import { TICKET_CONFIG_DEFAULT, type TicketConfig } from "../ticket-config";

export async function imprimirTicketVenta({
  config,
  receipt,
  negocio,
  metodoPagoTexto,
  logoUrl,
  ticketConfig = TICKET_CONFIG_DEFAULT,
}: {
  config: ConfigImpresora;
  receipt: SaleReceipt;
  negocio: DatosNegocioTicket;
  metodoPagoTexto: string;
  logoUrl?: string | null;
  ticketConfig?: TicketConfig;
}): Promise<void> {
  // Sin logo en la configuración no se descarga ni se convierte la imagen.
  const logo = ticketConfig.mostrarLogo ? await logoParaTicket(logoUrl, config.ancho) : null;
  const datos = ticketVentaEscPos({
    receipt,
    negocio,
    ancho: config.ancho,
    metodoPagoTexto,
    logo,
    ticketConfig,
  });
  await imprimirBytes(datos);
}

export async function imprimirPrueba(config: ConfigImpresora, negocio: string): Promise<void> {
  await imprimirBytes(ticketPruebaEscPos(config.ancho, negocio));
}
