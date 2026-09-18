/**
 * Reconstruye el ticket de una venta ya cobrada.
 *
 * El `SaleReceipt` que pinta `TicketReceipt` se construia en el Punto de Venta
 * a partir del carrito que estaba en memoria. Para reimprimir una venta vieja
 * ese carrito ya no existe: hay que rehacerlo desde lo guardado.
 *
 * Es logica pura a proposito. Toda la fidelidad del ticket reimpreso depende de
 * este mapeo —importes, variantes, nombre del cliente— y un fallo aqui produce
 * un papel que no coincide con lo que se cobro. Eso se prueba sin red.
 *
 * LIMITE CONOCIDO, decidido con el dueno: `detalle_ventas` no guarda copia del
 * nombre del producto al momento de vender. El ticket reimpreso usa el nombre
 * ACTUAL del catalogo; si el producto se renombro, saldra el nuevo, y si se
 * borro, "Producto eliminado" (lo resuelve el RPC `detalle_venta`). Para el uso
 * normal —reimprimir el ticket de hoy o de esta semana— es suficiente.
 */

import type { CartItem, SaleReceipt } from "@/features/pos/types/pos.types";
import type { UnidadMedida } from "@/lib/types/database";

/** Un renglon tal y como lo devuelve el RPC `detalle_venta`. */
export interface RenglonVenta {
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  unidad_medida: string;
  talla: string | null;
  color: string | null;
  cantidad: number | string;
  precio_unitario: number | string;
  descuento: number | string;
  subtotal: number | string;
}

/** La cabecera tal y como la devuelve el RPC `detalle_venta`. */
export interface VentaGuardada {
  id: string;
  fecha_venta: string;
  usuario_id: string | null;
  cajero_email: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  metodo_pago: string;
  estado: string;
  subtotal: number | string | null;
  impuesto: number | string | null;
  descuento: number | string | null;
  total: number | string;
  monto_recibido: number | string | null;
  cambio: number | string | null;
  notas: string | null;
  origen: string | null;
  requiere_revision: boolean | null;
  renglones: RenglonVenta[];
}

/**
 * Las columnas son `DECIMAL` y PostgREST las entrega como cadena ("116.00").
 * Sin esta conversion, `toFixed` del ticket reventaria y las sumas
 * concatenarian texto en vez de sumar.
 */
function aNumero(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Como se lee una variante en el ticket: "M · ROJO".
 *
 * ⚠️ Repite a proposito `variantLabel()` de `variant-picker-dialog.tsx`, que
 * vive en un componente cliente y arrastraria React a este modulo puro. El
 * formato TIENE que ser el mismo o el ticket reimpreso no se leeria igual que
 * el original; hay un test que compara las dos salidas.
 */
export function etiquetaVariante(
  talla: string | null,
  color: string | null
): string | null {
  const partes = [talla, color].filter(Boolean);
  if (partes.length === 0) return null;
  return partes.join(" · ");
}

/** Cliente general cuando la venta no llevaba cliente asociado. */
export const CLIENTE_GENERAL = "Cliente general";

/**
 * De lo guardado al ticket.
 *
 * `esReimpresion` se marca siempre: esta funcion solo se usa para volver a
 * sacar una venta que ya se cobro, y un ticket reimpreso sin distintivo sirve
 * para justificar una devolucion falsa.
 */
export function construirReceiptDesdeVenta(venta: VentaGuardada): SaleReceipt {
  const items: CartItem[] = (venta.renglones ?? []).map((r) => ({
    productId: r.producto_id,
    varianteId: r.variante_id,
    varianteLabel: etiquetaVariante(r.talla, r.color),
    nombre: r.nombre,
    cantidad: aNumero(r.cantidad),
    precioUnitario: aNumero(r.precio_unitario),
    descuento: aNumero(r.descuento),
    unidad_medida: (r.unidad_medida || "PIEZA") as UnidadMedida,
  }));

  return {
    items,
    total: aNumero(venta.total),
    paymentMethod: venta.metodo_pago,
    // El ticket original imprime "Cliente general" cuando no hay cliente; si
    // aqui se dejara `null` el reimpreso saldria sin esa linea.
    customerName: venta.cliente_nombre ?? CLIENTE_GENERAL,
    customerPhone: venta.cliente_telefono ?? null,
    // Solo tienen sentido en efectivo; el ticket ya decide si los pinta.
    montoRecibido: venta.monto_recibido === null ? null : aNumero(venta.monto_recibido),
    cambio: venta.cambio === null ? null : aNumero(venta.cambio),
    reference: venta.id,
    // La fecha de la VENTA, no la de hoy: es lo que distingue una reimpresion
    // fiel de un papel que miente sobre cuando se cobro.
    fecha: new Date(venta.fecha_venta),
    cajero: venta.cajero_email ?? null,
    esReimpresion: true,
  };
}
