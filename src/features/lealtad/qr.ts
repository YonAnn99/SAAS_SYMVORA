/**
 * QR de la tarjeta como SVG. Sirve igual en el servidor (pagina publica) y en
 * el navegador (ventana de la tarjeta en Clientes). El QR lleva la URL publica
 * de la tarjeta: con la camara del celular abre la tarjeta, y el escaner del
 * POS extrae el codigo de esa URL (`codigoDesdeEscaneo`).
 */
import QRCode from "qrcode";

export function qrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}
