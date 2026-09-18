"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Check, Printer } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import {
  clavePagoI18n,
  fechaTicket,
  formatearImporte,
  muestraEfectivo,
  numeroOperacion,
  subtotalLinea,
  totalArticulos,
} from "../ticket-format";
import type { SaleReceipt } from "../types/pos.types";

interface TicketReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: SaleReceipt | null;
}

export function TicketReceipt({
  open,
  onOpenChange,
  receipt,
}: TicketReceiptProps) {
  const t = useTranslations();
  const { tenantName, tenantLogo, tenantAddress } = useCurrentTenant();

  // `document` no existe en el servidor: el portal solo puede crearse ya
  // montado en el cliente.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);

  if (!receipt) return null;

  // Una REIMPRESION trae la fecha de la venta; el cobro normal la omite y
  // usa la de ahora, que es la correcta. Sin esto, el ticket de una venta
  // de la semana pasada saldria fechado hoy.
  const fecha = fechaTicket(receipt.fecha ?? undefined);
  const operacion = numeroOperacion(receipt.reference);
  const articulos = totalArticulos(receipt.items);
  const conEfectivo = muestraEfectivo(
    receipt.paymentMethod,
    receipt.montoRecibido
  );
  const paymentLabel = t(
    clavePagoI18n(receipt.paymentMethod)
  );

  // El contenido del ticket se usa DOS veces: dentro del diálogo como vista
  // previa, y en el contenedor de impresión de más abajo. Es la misma función
  // para que lo que se ve en pantalla y lo que sale por la impresora no puedan
  // divergir.
  const cuerpoTicket = (
    <div className="ticket-cuerpo">
      <header className="ticket-cabecera">
        {tenantLogo && (
          // El logo del NEGOCIO, no el de SYMVORA: el ticket lo recibe el
          // comprador, que le compró a la tienda.
          <Image
            src={tenantLogo}
            alt={tenantName}
            width={160}
            height={80}
            className="ticket-logo"
            unoptimized
          />
        )}
        <p className="ticket-negocio">{tenantName}</p>
      </header>

      <p className="ticket-seccion">DETALLE DE PRODUCTOS</p>
      <div className="ticket-meta">
        {operacion && <span>Operación #{operacion}</span>}
        <span>{fecha}</span>
        {receipt.cajero && <span>Atendió: {receipt.cajero}</span>}
      </div>

      {/* Distintivo de copia. Un ticket reimpreso sin marcar sirve para
          justificar una devolución falsa, así que se separa del original de un
          vistazo. */}
      {receipt.esReimpresion && (
        <p className="ticket-reimpresion">*** REIMPRESIÓN ***</p>
      )}

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
                  <span className="ticket-col-izq">x{item.cantidad} u.</span>
                  <span className="ticket-col-der">
                    {formatearImporte(item.precioUnitario)}/u.
                  </span>
                  <span className="ticket-col-der">
                    {formatearImporte(subtotalLinea(item))}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-fila">
        <span>Cant. total de items</span>
        <span>{articulos}</span>
      </div>

      <div className="ticket-total">
        <span>Total $</span>
        <span>{formatearImporte(receipt.total)}</span>
      </div>

      {conEfectivo ? (
        <>
          <div className="ticket-fila">
            <span>Efectivo $</span>
            <span>{formatearImporte(receipt.montoRecibido ?? 0)}</span>
          </div>
          <div className="ticket-fila">
            <span>Cambio $</span>
            <span>{formatearImporte(receipt.cambio ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="ticket-fila">
          <span>Método de pago</span>
          <span>{paymentLabel}</span>
        </div>
      )}

      {receipt.customerName && (
        <div className="ticket-fila">
          <span>Cliente</span>
          <span>{receipt.customerName}</span>
        </div>
      )}

      <footer className="ticket-pie">
        <p className="ticket-negocio-pie">{tenantName}</p>
        {tenantAddress && <p className="ticket-direccion">{tenantAddress}</p>}
        {/*
          No es decorativo: el módulo CFDI está apagado, así que esto NO es un
          comprobante fiscal y el papel tiene que decirlo.
        */}
        <p className="ticket-aviso">SIN VALIDEZ FISCAL</p>
        <p className="ticket-marca">Generado con SYMVORA</p>
      </footer>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-emerald-500" />
              Venta completada
            </DialogTitle>
          </DialogHeader>

          <div className="ticket-preview max-h-[55vh] overflow-y-auto rounded-lg bg-white p-4 text-black">
            {cuerpoTicket}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="h-8 w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Aceptar
            </Button>
            <SpecularActionButton
              tone="money"
              className="h-8 w-full sm:w-auto"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir
            </SpecularActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        El ticket que se imprime de verdad, FUERA del diálogo.

        Va por PORTAL a `document.body` y eso no es un detalle: la regla de
        impresión oculta `body > *` y reexpone solo este nodo. Si colgara del
        árbol de React quedaría varios divs adentro, su ancestro se ocultaría y
        el ticket no se imprimiría por mucho `display:block` que llevara encima.
        Como hijo directo de `body`, el selector lo alcanza.

        Tampoco vale imprimir el contenido del diálogo: vive en otro portal con
        `position: fixed` y transforms, y el navegador lo recorta.
      */}
      {open && montado
        ? createPortal(
            <div id="ticket-impresion">{cuerpoTicket}</div>,
            document.body
          )
        : null}
    </>
  );
}
