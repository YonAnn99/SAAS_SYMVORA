"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Moneda } from "@/lib/money";
import { abreviatura, formatearCantidad } from "@/lib/unidades";
import {
  clavePagoI18n,
  desgloseTicket,
  fechaTicket,
  formatearImporte,
  marcaMonedaTicket,
  importeLinea,
  muestraEfectivo,
  numeroOperacion,
  totalArticulos,
} from "../ticket-format";
import type { SaleReceipt } from "../types/pos.types";
import type { TicketConfig } from "../ticket-config";

export interface NegocioTicket {
  nombre: string;
  logo: string | null;
  direccion: string | null;
  moneda: Moneda;
}

/**
 * El ticket en pantalla. Lo usan el diálogo del cobro, la reimpresión, la impresión por navegador y la
 * vista previa de Configuración: una sola función para que lo que se ve y lo que sale no diverjan.
 *
 * `config` debe venir YA EFECTIVA (`useTicketConfigEfectiva`).
 */
export function TicketCuerpo({
  receipt,
  negocio,
  config,
}: {
  receipt: SaleReceipt;
  negocio: NegocioTicket;
  config: TicketConfig;
}) {
  const t = useTranslations();
  const { moneda } = negocio;
  const marca = marcaMonedaTicket(moneda);
  const importe = (n: number) => formatearImporte(n, moneda);

  // Una REIMPRESIÓN trae la fecha de la venta; el cobro normal la omite y usa la de ahora.
  const fecha = fechaTicket(receipt.fecha ?? undefined);
  const operacion = numeroOperacion(receipt.reference);
  const articulos = totalArticulos(receipt.items);
  const desglose = desgloseTicket(receipt.items, receipt.total);
  // Sin descuento ni IVA el total ES el subtotal: repetirlo solo alarga el papel.
  const conDesglose = desglose.descuento > 0 || desglose.impuesto > 0;
  const conEfectivo = muestraEfectivo(receipt.paymentMethod, receipt.montoRecibido);
  const paymentLabel = t(clavePagoI18n(receipt.paymentMethod));
  const lineasPie = config.mensajePie ? config.mensajePie.split("\n") : [];

  return (
    <div className="ticket-cuerpo">
      <header className="ticket-cabecera">
        {config.mostrarLogo && negocio.logo && (
          // El logo del NEGOCIO, no el de SYMVORA: el ticket lo recibe el comprador.
          <Image
            src={negocio.logo}
            alt={negocio.nombre}
            width={160}
            height={80}
            className="ticket-logo"
            unoptimized
          />
        )}
        <p className="ticket-negocio">{negocio.nombre}</p>
        {config.lineaExtra && <p className="ticket-direccion">{config.lineaExtra}</p>}
        {config.telefono && <p className="ticket-direccion">Tel. {config.telefono}</p>}
      </header>

      <p className="ticket-seccion">DETALLE DE PRODUCTOS</p>
      <div className="ticket-meta">
        {config.mostrarOperacion && operacion && <span>Operación #{operacion}</span>}
        <span>{fecha}</span>
        {config.mostrarCajero && receipt.cajero && <span>Atendió: {receipt.cajero}</span>}
      </div>

      {/* Distintivo de copia: un ticket reimpreso sin marcar sirve para justificar una devolución falsa. */}
      {receipt.esReimpresion && <p className="ticket-reimpresion">*** REIMPRESIÓN ***</p>}
      {receipt.cancelada && <p className="ticket-reimpresion">*** VENTA CANCELADA ***</p>}

      <table className="ticket-tabla">
        <thead>
          <tr>
            <th className="ticket-col-izq">Prod. y Cant.</th>
            <th className="ticket-col-der">Monto</th>
            <th className="ticket-col-der">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item) => (
            <tr key={`${item.productId}-${item.varianteId ?? "base"}`}>
              <td colSpan={3} className="ticket-producto">
                <span className="ticket-producto-nombre">
                  {item.nombre}
                  {item.varianteLabel ? ` · ${item.varianteLabel}` : ""}
                </span>
                <span className="ticket-producto-linea">
                  <span className="ticket-col-izq">x{formatearCantidad(item.cantidad, item.unidad_medida)}</span>
                  <span className="ticket-col-der">
                    {importe(item.precioUnitario)}/{abreviatura(item.unidad_medida, 1)}
                  </span>
                  <span className="ticket-col-der">{importe(importeLinea(item))}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {config.mostrarCantidadItems && (
        <div className="ticket-fila">
          <span>Cant. total de items</span>
          <span>{articulos}</span>
        </div>
      )}

      {conDesglose && (
        <>
          <div className="ticket-fila">
            <span>Subtotal {marca}</span>
            <span>{importe(desglose.subtotal)}</span>
          </div>
          {desglose.descuento > 0 && (
            <div className="ticket-fila">
              <span>{receipt.descuentoEtiqueta ?? "Descuento"} {marca}</span>
              <span>-{importe(desglose.descuento)}</span>
            </div>
          )}
          {desglose.impuesto > 0 && (
            <div className="ticket-fila">
              <span>IVA {marca}</span>
              <span>{importe(desglose.impuesto)}</span>
            </div>
          )}
        </>
      )}

      <div className="ticket-total">
        <span>Total {marca}</span>
        <span>{importe(receipt.total)}</span>
      </div>

      {conEfectivo ? (
        <>
          <div className="ticket-fila">
            <span>Efectivo {marca}</span>
            <span>{importe(receipt.montoRecibido ?? 0)}</span>
          </div>
          <div className="ticket-fila">
            <span>Cambio {marca}</span>
            <span>{importe(receipt.cambio ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="ticket-fila">
          <span>Método de pago</span>
          <span>{paymentLabel}</span>
        </div>
      )}

      {config.mostrarCliente && receipt.customerName && (
        <div className="ticket-fila">
          <span>Cliente</span>
          <span>{receipt.customerName}</span>
        </div>
      )}
      {receipt.lealtad && (
        <div className="ticket-fila">
          <span>{receipt.lealtad}</span>
        </div>
      )}

      <footer className="ticket-pie">
        <p className="ticket-negocio-pie">{negocio.nombre}</p>
        {config.mostrarDireccion && negocio.direccion && (
          <p className="ticket-direccion">{negocio.direccion}</p>
        )}
        {lineasPie.map((renglon, i) => (
          <p key={i} className="ticket-direccion">{renglon || " "}</p>
        ))}
        {config.redes && <p className="ticket-direccion">{config.redes}</p>}
        {/* No es decorativo: el módulo CFDI está apagado, así que esto NO es un comprobante fiscal. */}
        <p className="ticket-aviso">SIN VALIDEZ FISCAL</p>
        {!config.ocultarMarca && <p className="ticket-marca">Generado con SYMVORA</p>}
      </footer>
    </div>
  );
}
