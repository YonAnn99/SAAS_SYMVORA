/**
 * Lotes por sucursal (migracion 116): logica pura.
 *
 * La existencia de un producto en una sucursal es `stock_sucursal`; los lotes
 * REPARTEN esa existencia y lo que sobra es stock "sin lote". La venta consume
 * FEFO (el que caduca primero) y nunca vende lotes caducados. El servidor es
 * quien decide (`_consumir_lotes`); aqui solo se anticipa para la pantalla.
 */

export type EstadoCaducidad = "vencido" | "critico" | "pronto" | "vigente";

export interface ExistenciaLote {
  sucursal_id: string;
  cantidad: number;
}

export interface LoteFefo {
  id: string;
  numero_lote: string;
  fecha_caducidad: string | null;
  creado_en: string;
  /** Lo que hay de este lote en la sucursal que se mira. */
  cantidad: number;
}

/** "Hoy" en Mexico como `YYYY-MM-DD` (la caducidad es fecha de calendario). */
export function hoyMx(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Dias de `hoy` a la caducidad (negativo = ya caduco). Sin fecha: null. */
export function diasParaCaducar(fecha: string | null, hoy: string = hoyMx()): number | null {
  if (!fecha) return null;
  const a = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  const b = Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** Misma regla que el servidor: caduca HOY todavia se vende; ayer, no. */
export function estaVencido(fecha: string | null, hoy: string = hoyMx()): boolean {
  const dias = diasParaCaducar(fecha, hoy);
  return dias !== null && dias < 0;
}

export function estadoCaducidad(fecha: string | null, hoy: string = hoyMx()): EstadoCaducidad | null {
  const dias = diasParaCaducar(fecha, hoy);
  if (dias === null) return null;
  if (dias < 0) return "vencido";
  if (dias <= 7) return "critico";
  if (dias <= 30) return "pronto";
  return "vigente";
}

/** Existencia del lote en una sucursal, o en todas (`null`). */
export function existenciaEn(existencias: ExistenciaLote[] | null | undefined, sucursalId: string | null): number {
  return (existencias ?? [])
    .filter((e) => sucursalId === null || e.sucursal_id === sucursalId)
    .reduce((s, e) => s + Number(e.cantidad || 0), 0);
}

/** Orden FEFO del servidor: caducidad ascendente (sin fecha al final), luego antiguedad. */
export function ordenFefo<T extends Pick<LoteFefo, "fecha_caducidad" | "creado_en" | "id">>(lotes: T[]): T[] {
  return [...lotes].sort((a, b) => {
    if (a.fecha_caducidad !== b.fecha_caducidad) {
      if (!a.fecha_caducidad) return 1;
      if (!b.fecha_caducidad) return -1;
      return a.fecha_caducidad < b.fecha_caducidad ? -1 : 1;
    }
    if (a.creado_en !== b.creado_en) return a.creado_en < b.creado_en ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

export interface TomaLote {
  numero_lote: string;
  fecha_caducidad: string | null;
  cantidad: number;
  vencido: boolean;
}

/**
 * Que saldria de un traspaso de `cantidad` (misma regla que `registrar_traspaso`):
 * lotes vigentes FEFO, luego lo que esta sin lote y al final, si hace falta, lo
 * de lotes caducados.
 */
export function previsualizarTraspaso(
  lotes: LoteFefo[],
  stock: number,
  cantidad: number,
  hoy: string = hoyMx()
): { lotes: TomaLote[]; sinLote: number } {
  const conExistencia = ordenFefo(lotes.filter((l) => l.cantidad > 0));
  const enLotes = conExistencia.reduce((s, l) => s + l.cantidad, 0);
  const sinLoteDisponible = Math.max(stock - enLotes, 0);
  const tomas: TomaLote[] = [];
  let resto = cantidad;

  const tomar = (l: LoteFefo) => {
    if (resto <= 0) return;
    const toma = Math.min(resto, l.cantidad);
    tomas.push({
      numero_lote: l.numero_lote,
      fecha_caducidad: l.fecha_caducidad,
      cantidad: redondear(toma),
      vencido: estaVencido(l.fecha_caducidad, hoy),
    });
    resto = redondear(resto - toma);
  };

  conExistencia.filter((l) => !estaVencido(l.fecha_caducidad, hoy)).forEach(tomar);
  const sinLote = Math.min(Math.max(resto, 0), sinLoteDisponible);
  resto = redondear(resto - sinLote);
  conExistencia.filter((l) => estaVencido(l.fecha_caducidad, hoy)).forEach(tomar);

  return { lotes: tomas, sinLote: redondear(sinLote) };
}

/** Lo que se puede VENDER en una sucursal: stock menos lo de lotes caducados. */
export function vendibleConLotes(stock: number, lotes: LoteFefo[], hoy: string = hoyMx()): number {
  const vencido = lotes
    .filter((l) => estaVencido(l.fecha_caducidad, hoy))
    .reduce((s, l) => s + l.cantidad, 0);
  return Math.max(redondear(stock - vencido), 0);
}

export const ETIQUETA_MOVIMIENTO_LOTE: Record<string, string> = {
  ENTRADA: "Entrada",
  ASIGNACION: "Asignado al lote",
  COMPRA: "Compra",
  CANCELACION_COMPRA: "Compra cancelada",
  VENTA: "Venta",
  INSUMO: "Usado en servicio",
  TRASPASO_SALIDA: "Traspaso (salida)",
  TRASPASO_ENTRADA: "Traspaso (entrada)",
  AJUSTE: "Ajuste",
  CUADRE: "Cuadre con inventario",
};

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
