/**
 * Reglas de la recepcion de una orden de compra.
 *
 * Vive aparte del dialogo, como `stock-status.ts` e `inline-edit.ts`, porque es
 * lo unico con logica: cuanto queda pendiente, que se puede escribir, que viaja
 * al RPC y cuanto suma la entrega. El JSX solo pinta lo que sale de aqui.
 *
 * El motor esta en la base: `recibir_orden_compra(p_orden_id, p_items,
 * p_numero_factura)` acumula lo recibido, suma el stock, fija el costo y crea la
 * compra. Este modulo prepara su entrada y valida antes de llamarlo.
 */

export interface LineaOrden {
  id: string;
  producto_id: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  costo_unitario: number;
}

/** Lo que falta por llegar de una linea. Nunca negativo. */
export function pendientePorLinea(linea: {
  cantidad_solicitada: number;
  cantidad_recibida: number;
}): number {
  const pendiente =
    Number(linea.cantidad_solicitada) - Number(linea.cantidad_recibida);
  // Si alguien recibio de mas en el pasado (o se corrigio la orden a la baja),
  // el pendiente es cero, no un numero negativo que luego se restaria del
  // total de la entrega.
  return pendiente > 0 ? redondear(pendiente) : 0;
}

export type CantidadParseada =
  | { ok: true; valor: number }
  | { ok: false; error: string };

/**
 * Valida lo que se escribio en "llego ahora".
 *
 * El tope es el PENDIENTE, no lo solicitado: en una segunda entrega ya no se
 * puede volver a recibir lo que llego en la primera.
 */
export function parsearCantidadRecibida(
  texto: string,
  pendiente: number
): CantidadParseada {
  const limpio = texto.trim();
  if (limpio === "") return { ok: true, valor: 0 };

  const numero = Number(limpio);
  if (!Number.isFinite(numero)) {
    return { ok: false, error: "Escribe una cantidad válida" };
  }
  if (numero < 0) {
    return { ok: false, error: "La cantidad no puede ser negativa" };
  }
  if (numero > pendiente) {
    // El RPC no lo comprueba: aceptaria recibir 100 de una orden de 10 y
    // sumaria 100 al stock. La barrera tiene que estar aqui.
    return {
      ok: false,
      error: `Solo quedan ${pendiente} por recibir`,
    };
  }
  return { ok: true, valor: redondear(numero) };
}

export interface LineaRecepcion {
  detalle_id: string;
  cantidad_recibida: number;
  costo_unitario: number;
}

/** El `p_items` que espera el RPC. */
export function construirItems(
  lineas: LineaRecepcion[]
): { detalle_id: string; cantidad_recibida: number }[] {
  // Las lineas en cero se omiten: mandarlas haria un UPDATE que suma 0 y, peor,
  // contaria como "esta linea no llego completa" al decidir si la orden queda
  // parcial o total.
  return lineas
    .filter((l) => l.cantidad_recibida > 0)
    .map((l) => ({
      detalle_id: l.detalle_id,
      cantidad_recibida: l.cantidad_recibida,
    }));
}

export interface TotalesRecepcion {
  subtotal: number;
  impuesto: number;
  total: number;
}

/**
 * Lo que vale ESTA entrega, no la orden entera.
 *
 * La tasa se recibe calculada desde la orden (`impuesto / subtotal`) en vez de
 * usar un 16 % fijo: si una orden se guardo con otra tasa, la compra generada
 * debe cuadrar con ella.
 */
export function totalesRecepcion(
  lineas: LineaRecepcion[],
  tasaIva: number
): TotalesRecepcion {
  const subtotal = redondear2(
    lineas.reduce((acc, l) => acc + l.cantidad_recibida * l.costo_unitario, 0)
  );
  const impuesto = redondear2(subtotal * tasaIva);
  return { subtotal, impuesto, total: redondear2(subtotal + impuesto) };
}

/**
 * La tasa efectiva de la orden.
 *
 * Con subtotal 0 no se puede dividir; se devuelve 0 en vez de `NaN`, que
 * acabaria escrito como importe en la compra.
 */
export function tasaIvaDeOrden(orden: {
  subtotal: number;
  impuesto: number;
}): number {
  const subtotal = Number(orden.subtotal);
  if (!(subtotal > 0)) return 0;
  return Number(orden.impuesto) / subtotal;
}

/** Si tras esta entrega seguira faltando mercancía. */
export function quedaPendiente(
  lineas: (LineaOrden & { recibirAhora: number })[]
): boolean {
  return lineas.some(
    (l) =>
      Number(l.cantidad_recibida) + l.recibirAhora <
      Number(l.cantidad_solicitada)
  );
}

/** Cantidades: 3 decimales, como `DECIMAL(10,3)`. */
function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Importes: 2 decimales, como `DECIMAL(10,2)`. */
function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}
