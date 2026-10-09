/**
 * El ticket de venta en ESC/POS: el MISMO contenido que el ticket en pantalla
 * (`components/ticket-receipt.tsx`), acomodado a 32 columnas (58 mm) o 48
 * (80 mm). Usa los mismos helpers de `ticket-format.ts`, asi que lo que se ve
 * y lo que sale en papel no pueden diferir.
 */

import { abreviatura, formatearCantidad } from "@/lib/unidades";
import {
  desgloseTicket,
  fechaTicket,
  formatearImporte,
  importeLinea,
  muestraEfectivo,
  numeroOperacion,
  totalArticulos,
} from "../ticket-format";
import type { SaleReceipt } from "../types/pos.types";
import { TicketEscPos, columnas, izquierdaDerecha, type AnchoPapel } from "./escpos";

export interface DatosNegocioTicket {
  nombre: string;
  direccion?: string | null;
}

export interface LogoTicket {
  datos: Uint8Array;
  anchoBytes: number;
  alto: number;
}

export function ticketVentaEscPos({
  receipt,
  negocio,
  ancho,
  metodoPagoTexto,
  logo,
}: {
  receipt: SaleReceipt;
  negocio: DatosNegocioTicket;
  ancho: AnchoPapel;
  /** Nombre del metodo de pago ya traducido ("Tarjeta"...). */
  metodoPagoTexto: string;
  logo?: LogoTicket | null;
}): Uint8Array {
  const t = new TicketEscPos(ancho);
  const cols = t.columnas;
  // Montos: "precio/u" y "subtotal". El resto del renglon, la cantidad.
  const anchoMonto = ancho === 58 ? 11 : 16;
  const anchoSubtotal = ancho === 58 ? 10 : 14;

  // Cabecera
  t.alinear("centro");
  if (logo) t.imagen(logo.datos, logo.anchoBytes, logo.alto).salto();
  t.negritas(true).parrafo(negocio.nombre).negritas(false);
  t.salto();

  t.alinear("izquierda");
  t.negritas(true).linea("DETALLE DE PRODUCTOS").negritas(false);
  const operacion = numeroOperacion(receipt.reference);
  if (operacion) t.linea(`Operación #${operacion}`);
  t.linea(fechaTicket(receipt.fecha ?? undefined));
  if (receipt.cajero) t.parrafo(`Atendió: ${receipt.cajero}`);

  if (receipt.esReimpresion) {
    t.alinear("centro").negritas(true).linea("*** REIMPRESIÓN ***").negritas(false).alinear("izquierda");
  }

  t.separador();
  t.negritas(true)
    .linea(columnas(["Prod. y Cant.", "Monto", "Subtotal"], [0, anchoMonto, anchoSubtotal], cols))
    .negritas(false);
  t.separador();

  for (const item of receipt.items) {
    const nombre = item.varianteLabel ? `${item.nombre} · ${item.varianteLabel}` : item.nombre;
    t.negritas(true).parrafo(nombre).negritas(false);
    t.linea(
      columnas(
        [
          `x${formatearCantidad(item.cantidad, item.unidad_medida)}`,
          `${formatearImporte(item.precioUnitario)}/${abreviatura(item.unidad_medida, 1)}`,
          formatearImporte(importeLinea(item)),
        ],
        [0, anchoMonto, anchoSubtotal],
        cols
      )
    );
  }

  t.separador();
  t.linea(izquierdaDerecha("Cant. total de items", String(totalArticulos(receipt.items)), cols));

  // Mismo desglose que el ticket en pantalla: solo con descuento o IVA.
  const desglose = desgloseTicket(receipt.items, receipt.total);
  if (desglose.descuento > 0 || desglose.impuesto > 0) {
    t.linea(izquierdaDerecha("Subtotal $", formatearImporte(desglose.subtotal), cols));
    if (desglose.descuento > 0) {
      t.linea(
        izquierdaDerecha(
          `${receipt.descuentoEtiqueta ?? "Descuento"} $`,
          `-${formatearImporte(desglose.descuento)}`,
          cols
        )
      );
    }
    if (desglose.impuesto > 0) {
      t.linea(izquierdaDerecha("IVA $", formatearImporte(desglose.impuesto), cols));
    }
  }

  // Total en letra grande: ocupa el doble, asi que se arma a media anchura.
  t.negritas(true).grande(true)
    .linea(izquierdaDerecha("Total $", formatearImporte(receipt.total), Math.floor(cols / 2)))
    .grande(false).negritas(false);

  if (muestraEfectivo(receipt.paymentMethod, receipt.montoRecibido)) {
    t.linea(izquierdaDerecha("Efectivo $", formatearImporte(receipt.montoRecibido ?? 0), cols));
    t.linea(izquierdaDerecha("Cambio $", formatearImporte(receipt.cambio ?? 0), cols));
  } else {
    t.linea(izquierdaDerecha("Método de pago", metodoPagoTexto, cols));
  }
  if (receipt.customerName) {
    t.linea(izquierdaDerecha("Cliente", receipt.customerName, cols));
  }
  if (receipt.lealtad) {
    t.parrafo(receipt.lealtad);
  }

  // Pie
  t.separador();
  t.alinear("centro");
  t.negritas(true).parrafo(negocio.nombre).negritas(false);
  if (negocio.direccion) t.parrafo(negocio.direccion);
  // No es decorativo: el modulo CFDI esta apagado, esto NO es comprobante fiscal.
  t.negritas(true).linea("SIN VALIDEZ FISCAL").negritas(false);
  t.linea("Generado con SYMVORA");
  t.alinear("izquierda");

  return t.cortar().resultado();
}

/** Hoja de prueba para "Imprimir prueba". */
export function ticketPruebaEscPos(ancho: AnchoPapel, negocio: string): Uint8Array {
  const t = new TicketEscPos(ancho);
  return t
    .alinear("centro")
    .negritas(true)
    .linea("Impresora conectada")
    .negritas(false)
    .linea(negocio)
    .salto()
    .linea(`Papel de ${ancho} mm · ${t.columnas} columnas`)
    .linea("Acentos: áéíóú ñ Ñ ¿? ¡!")
    .separador()
    .linea("SYMVORA")
    .alinear("izquierda")
    .cortar()
    .resultado();
}
