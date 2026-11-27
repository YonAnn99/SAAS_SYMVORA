import { describe, expect, it } from "vitest";
import { ticketVentaEscPos, type LogoTicket } from "@/features/pos/impresora/ticket-escpos";
import { TICKET_CONFIG_DEFAULT, type TicketConfig } from "@/features/pos/ticket-config";
import type { SaleReceipt } from "@/features/pos/types/pos.types";

const venta: SaleReceipt = {
  items: [
    { productId: "p1", varianteId: null, nombre: "Café americano", cantidad: 2, precioUnitario: 35, descuento: 0, unidad_medida: "PIEZA" },
  ],
  total: 70,
  paymentMethod: "EFECTIVO",
  customerName: "María López",
  montoRecibido: 100,
  cambio: 30,
  reference: "11111111-2222-3333-4444-555555555555",
  cajero: "Ana",
  // Fecha fija: el ticket imprime segundos y dos llamadas podrían cruzar uno.
  fecha: new Date("2026-11-26T22:53:00-06:00"),
};

const logo: LogoTicket = { datos: new Uint8Array([0xff, 0x00]), anchoBytes: 1, alto: 2 };
const texto = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const imprimir = (cfg?: Partial<TicketConfig>, extra: { logo?: LogoTicket | null } = {}) =>
  ticketVentaEscPos({
    receipt: venta,
    negocio: { nombre: "Abarrotes Doña Lupe", direccion: "Calle 1" },
    ancho: 58,
    metodoPagoTexto: "Efectivo",
    logo: extra.logo ?? null,
    ticketConfig: cfg ? { ...TICKET_CONFIG_DEFAULT, ...cfg } : TICKET_CONFIG_DEFAULT,
  });

describe("ticket ESC/POS con configuración", () => {
  it("con la configuración por defecto sale IGUAL que sin configuración", () => {
    const sin = ticketVentaEscPos({
      receipt: venta,
      negocio: { nombre: "Abarrotes Doña Lupe", direccion: "Calle 1" },
      ancho: 58,
      metodoPagoTexto: "Efectivo",
      logo: null,
    });
    expect(Array.from(imprimir())).toEqual(Array.from(sin));
  });

  it("ocultar la marca quita «Generado con SYMVORA» y deja lo demás", () => {
    const con = texto(imprimir());
    const sin = texto(imprimir({ ocultarMarca: true }));
    expect(con).toContain("Generado con SYMVORA");
    expect(sin).not.toContain("Generado con SYMVORA");
    expect(sin).toContain("SIN VALIDEZ FISCAL");
  });

  it("muestra teléfono, línea extra, mensaje de pie y redes", () => {
    const out = texto(
      imprimir({ telefono: "5512345678", lineaExtra: "RFC XAXX010101000", mensajePie: "¡Gracias por tu compra!", redes: "@lupe.tienda" })
    );
    expect(out).toContain("Tel. 5512345678");
    expect(out).toContain("RFC XAXX010101000");
    expect(out).toContain("Gracias por tu compra");
    expect(out).toContain("@lupe.tienda");
  });

  it("cada interruptor oculta su renglón", () => {
    expect(texto(imprimir({ mostrarOperacion: false }))).not.toContain("Operación #");
    expect(texto(imprimir({ mostrarCajero: false }))).not.toContain("Atendió");
    expect(texto(imprimir({ mostrarCliente: false }))).not.toContain("María");
    expect(texto(imprimir({ mostrarCantidadItems: false }))).not.toContain("Cant. total de items");
    expect(texto(imprimir({ mostrarDireccion: false }))).not.toContain("Calle 1");
  });

  it("sin logo activado no se imprime la imagen", () => {
    const con = imprimir({}, { logo });
    const sin = imprimir({ mostrarLogo: false }, { logo });
    // Comando de imagen ESC/POS: GS v 0
    const comandoLogo = [0x1d, 0x76, 0x30, 0x00];
    expect(Array.from(con).join(",")).toContain(comandoLogo.join(","));
    expect(Array.from(sin).join(",")).not.toContain(comandoLogo.join(","));
  });
});
