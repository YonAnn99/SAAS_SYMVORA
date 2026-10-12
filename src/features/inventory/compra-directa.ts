/**
 * Validacion y normalizacion de los renglones de una compra directa.
 *
 * POR QUE EXISTE. Antes, "Nueva compra" pedia proveedor, numero de factura y un
 * total a mano, y guardaba una cabecera sin renglones que no movia inventario.
 * Medido en produccion: de 12 compras, 5 eran cabeceras vacias por $7,500 que
 * no sumaron una sola unidad. Ahora la compra directa SI mueve stock, y en
 * cuanto mueve stock los renglones mal formados dejan de ser un detalle
 * cosmetico: una cantidad vacia que llegara como 0 crearia una compra que no
 * acredita nada, y una negativa RESTARIA inventario desde una pantalla de
 * compras.
 *
 * El servidor valida lo mismo y es quien manda (ver `registrar_compra_directa`
 * en la migracion 074). Esto es para decirlo ANTES del viaje y con un mensaje
 * que se entienda, no para sustituirlo.
 *
 * Los renglones llegan como CADENAS porque vienen de campos de texto, igual que
 * en `purchase-order-totals.ts`. Un campo a medio escribir vale 0, no `NaN`.
 */

import { descomponerValor } from "./purchase-order-items";

/** Un renglon tal y como lo tiene el formulario. */
export interface RenglonCompraForm {
  /** Producto o variante codificados por `componerValor()`. */
  valor: string;
  cantidad: string;
  costo_unitario: string;
  /** Lote y caducidad (migracion 116). Solo se piden en productos con lotes. */
  numero_lote?: string;
  fecha_caducidad?: string;
}

/** Un renglon listo para el RPC. */
export interface RenglonCompraRpc {
  producto_id: string;
  variante_id: string | null;
  cantidad: number;
  costo_unitario: number;
  /** Solo si el renglon trae lote: el servidor lo da de alta en la sucursal. */
  numero_lote?: string;
  fecha_caducidad?: string | null;
}

export type MotivoRenglonInvalido =
  | "sin-renglones"
  | "sin-producto"
  | "cantidad-invalida"
  | "costo-invalido"
  | "caducidad-sin-lote";

export interface ValidacionCompra {
  ok: boolean;
  motivo?: MotivoRenglonInvalido;
  /** 1-indexado, para poder decir "el renglon 3". `null` si el fallo es global. */
  renglon: number | null;
}

export const MENSAJES_RENGLON: Record<MotivoRenglonInvalido, string> = {
  "sin-renglones": "Agrega al menos un producto a la compra",
  "sin-producto": "Elige el producto de cada renglón",
  "cantidad-invalida": "La cantidad de cada renglón debe ser mayor que cero",
  "costo-invalido": "El costo de cada renglón no puede ser negativo",
  "caducidad-sin-lote": "Pon el número de lote de la caducidad que capturaste",
};

/**
 * Renglones que el usuario todavia no ha tocado.
 *
 * El formulario arranca con una fila vacia y añade otra al pulsar "Agregar":
 * sin esto, una fila en blanco al final bloquearia el guardado de una compra
 * por lo demas correcta.
 */
function estaVacio(r: RenglonCompraForm): boolean {
  return !r.valor && !r.cantidad.trim() && !r.costo_unitario.trim();
}

/** Los renglones que cuentan: se descartan las filas intactas. */
export function renglonesConDatos(
  renglones: RenglonCompraForm[]
): RenglonCompraForm[] {
  return renglones.filter((r) => !estaVacio(r));
}

/** Primer problema que impide guardar, o `ok` si no hay ninguno. */
export function validarCompraDirecta(
  renglones: RenglonCompraForm[]
): ValidacionCompra {
  const utiles = renglonesConDatos(renglones);
  if (utiles.length === 0) {
    return { ok: false, motivo: "sin-renglones", renglon: null };
  }

  for (let i = 0; i < utiles.length; i++) {
    const r = utiles[i];
    const numero = i + 1;

    if (!r.valor) return { ok: false, motivo: "sin-producto", renglon: numero };

    const cantidad = parseFloat(r.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { ok: false, motivo: "cantidad-invalida", renglon: numero };
    }

    // Un costo de 0 SI vale: hay mercancia de regalo, muestras y bonificaciones
    // del proveedor. Lo que no vale es negativo, que seria cobrarle al
    // proveedor por llevarse la mercancia.
    const costo = parseFloat(r.costo_unitario);
    if (!Number.isFinite(costo) || costo < 0) {
      return { ok: false, motivo: "costo-invalido", renglon: numero };
    }

    // La caducidad vive en el lote: sin numero no hay donde guardarla.
    if (r.fecha_caducidad?.trim() && !r.numero_lote?.trim()) {
      return { ok: false, motivo: "caducidad-sin-lote", renglon: numero };
    }
  }

  return { ok: true, renglon: null };
}

/**
 * Traduce los renglones del formulario a lo que espera el RPC.
 *
 * Manda `variante_id` cuando la hay y deja que el SERVIDOR deduzca el producto
 * padre a partir de ella. Mandar los dos y que no casaran acreditaria el stock
 * en un cubo mientras el renglon nombra otro producto.
 */
export function aRenglonesRpc(
  renglones: RenglonCompraForm[]
): RenglonCompraRpc[] {
  return renglonesConDatos(renglones).map((r) => {
    const { productoId, varianteId } = descomponerValor(r.valor);
    const renglon: RenglonCompraRpc = {
      producto_id: productoId,
      variante_id: varianteId,
      cantidad: parseFloat(r.cantidad),
      costo_unitario: parseFloat(r.costo_unitario),
    };
    // Sin lote, el renglon va exactamente como antes de la 116.
    const lote = r.numero_lote?.trim();
    if (lote) {
      renglon.numero_lote = lote;
      renglon.fecha_caducidad = r.fecha_caducidad?.trim() || null;
    }
    return renglon;
  });
}
