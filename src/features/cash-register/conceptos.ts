/**
 * Por qué entra o sale dinero de la caja (`movimientos_caja.concepto`,
 * migración 093).
 *
 * Las salidas manuales llevan motivo: depósito al banco, retiro del dueño u
 * otro gasto. Las que registra el sistema al pagar una compra con efectivo son
 * COMPRA, y su devolución al cancelarla, DEVOLUCION_COMPRA. Las entradas
 * manuales y los movimientos de venta no llevan concepto (NULL).
 */

export const CONCEPTOS_SALIDA = [
  "DEPOSITO_BANCO",
  "RETIRO_EFECTIVO",
  "OTRO_GASTO",
] as const;

export type ConceptoSalida = (typeof CONCEPTOS_SALIDA)[number];

export type ConceptoMovimiento =
  | ConceptoSalida
  | "COMPRA"
  | "DEVOLUCION_COMPRA";

/** El motivo que se propone al elegir "Salida". */
export const CONCEPTO_SALIDA_POR_DEFECTO: ConceptoSalida = "OTRO_GASTO";

export function esConceptoSalida(valor: unknown): valor is ConceptoSalida {
  return (CONCEPTOS_SALIDA as readonly unknown[]).includes(valor);
}

/**
 * La descripción que se guarda.
 *
 * En un depósito o un retiro el motivo ya dice qué pasó, así que la
 * descripción es opcional y, vacía, se guarda el nombre del motivo. En "Otro
 * gasto" el motivo no dice nada: sin descripción no se sabría en qué se fue el
 * dinero, así que es obligatoria (devuelve `null`).
 */
export function descripcionDeMovimiento(
  concepto: ConceptoSalida | null,
  descripcion: string,
  etiquetaConcepto: string
): string | null {
  const texto = descripcion.trim();
  if (texto) return texto;
  if (concepto === "DEPOSITO_BANCO" || concepto === "RETIRO_EFECTIVO") {
    return etiquetaConcepto;
  }
  return null;
}

export interface CajaAbierta {
  id: string;
  sucursal_id: string | null;
  fecha_apertura: string;
  sucursal: { nombre: string } | null;
}

/**
 * De qué caja sale el efectivo para pagar una compra.
 *
 * Un usuario puede tener una caja abierta por sucursal (migración 086). Se usa
 * la del local que recibe la mercancía, que es donde normalmente se paga al
 * repartidor; si no tiene caja ahí, la que abrió más recientemente.
 */
export function cajaParaPago(
  cajas: CajaAbierta[],
  sucursalId: string | null
): CajaAbierta | null {
  if (cajas.length === 0) return null;
  const delLocal = sucursalId
    ? cajas.find((c) => c.sucursal_id === sucursalId)
    : undefined;
  if (delLocal) return delLocal;
  return [...cajas].sort((a, b) =>
    b.fecha_apertura.localeCompare(a.fecha_apertura)
  )[0];
}
