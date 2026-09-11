/**
 * Cálculo de ganancia sobre productos (margen bruto).
 *
 * Fuente única para las cuatro pantallas que muestran ganancia (formulario de
 * producto, tabla de productos, Reportes y Dashboard), para que no diverjan.
 *
 * DOS REGLAS QUE NO SE DEBEN RELAJAR:
 *
 * 1. **El IVA no entra.** Todo se calcula sobre el subtotal, nunca sobre
 *    `ventas.total`. El IVA se cobra para enterarlo al SAT: no es dinero del
 *    negocio, y contarlo inflaría la ganancia un 16%. `detalle_ventas.subtotal`
 *    ya es pre-impuesto (`precio_unitario * cantidad`, ver migración 042).
 *
 * 2. **Un costo nulo se excluye, no se trata como cero.** Un producto sin
 *    costo capturado no es un producto con 100% de ganancia. Mezclarlos daría
 *    un número inflado del que nadie sospecharía. Se cuentan aparte para poder
 *    avisar de cuántos quedaron fuera.
 *
 * ALCANCE: esto es margen BRUTO sobre producto. No descuenta renta, sueldos,
 * luz ni la suscripción de SYMVORA. No es la utilidad del negocio, y la UI no
 * debe llamarlo así.
 */

export interface ProfitRatios {
  /** Ganancia por unidad, en pesos. */
  gananciaUnitaria: number;
  /** Ganancia / precio · 100 — "de cada $100 que entran, cuánto es mío". */
  margenPct: number;
  /** Ganancia / costo · 100 — "cuánto le gano sobre lo que me costó". */
  markupPct: number;
  /** El costo iguala o supera al precio: se vende con pérdida. */
  esPerdida: boolean;
}

/**
 * Margen y markup de un producto a partir de su precio y costo.
 *
 * Devuelve `null` si no hay datos suficientes para un número honesto: sin
 * costo capturado, o con precio en cero.
 *
 * Margen y markup NO son lo mismo y se confunden constantemente: $15 con costo
 * $10 da 33.3% de margen y 50% de markup. Se devuelven ambos para que la UI
 * pueda etiquetarlos por su nombre.
 */
export function calcularMargenProducto(
  precioVenta: number,
  costoCompra: number | null | undefined
): ProfitRatios | null {
  if (costoCompra == null || !Number.isFinite(costoCompra)) return null;
  if (!Number.isFinite(precioVenta) || precioVenta <= 0) return null;

  const ganancia = precioVenta - costoCompra;

  return {
    gananciaUnitaria: round2(ganancia),
    margenPct: round2((ganancia / precioVenta) * 100),
    // Con costo 0 el markup es infinito: se reporta como 0 para no propagar
    // Infinity a la UI. El margen (100%) sigue siendo el dato útil ahí.
    markupPct: costoCompra > 0 ? round2((ganancia / costoCompra) * 100) : 0,
    esPerdida: costoCompra >= precioVenta,
  };
}

/** Una línea de venta, tal como viene de `detalle_ventas`. */
export interface SaleLineForProfit {
  cantidad: number;
  /** Pre-IVA: `precio_unitario * cantidad`. */
  subtotal: number;
  descuento: number;
  /** Costo congelado al vender. `null` en ventas anteriores a la migración 052. */
  costo_unitario: number | null;
  producto_id?: string;
}

export interface ProfitSummary {
  /** Ingreso pre-IVA de las líneas SÍ computables. */
  ingresos: number;
  /** Costo de lo vendido (COGS). */
  costoVendido: number;
  ganancia: number;
  margenPct: number;
  /** Líneas incluidas en el cálculo. */
  lineasComputadas: number;
  /** Líneas excluidas por no tener costo capturado. */
  lineasSinCosto: number;
  /** Ids de producto sin costo, para el aviso. */
  productosSinCosto: string[];
}

/**
 * Agrega la ganancia de un conjunto de líneas de venta.
 *
 * Las líneas sin `costo_unitario` se excluyen por completo — ni su ingreso ni
 * su costo entran. Incluir su ingreso pero no su costo daría un margen
 * artificialmente alto, que es el error más fácil de cometer aquí.
 */
export function calcularGanancia(lineas: SaleLineForProfit[]): ProfitSummary {
  let ingresos = 0;
  let costoVendido = 0;
  let lineasComputadas = 0;
  let lineasSinCosto = 0;
  const productosSinCosto = new Set<string>();

  for (const linea of lineas) {
    if (linea.costo_unitario == null || !Number.isFinite(linea.costo_unitario)) {
      lineasSinCosto++;
      if (linea.producto_id) productosSinCosto.add(linea.producto_id);
      continue;
    }

    ingresos += linea.subtotal - (linea.descuento ?? 0);
    costoVendido += linea.costo_unitario * linea.cantidad;
    lineasComputadas++;
  }

  ingresos = round2(ingresos);
  costoVendido = round2(costoVendido);
  const ganancia = round2(ingresos - costoVendido);

  return {
    ingresos,
    costoVendido,
    ganancia,
    margenPct: ingresos > 0 ? round2((ganancia / ingresos) * 100) : 0,
    lineasComputadas,
    lineasSinCosto,
    productosSinCosto: [...productosSinCosto],
  };
}

/** Ganancia por producto, ordenada por lo que más deja (no por lo que más factura). */
export function gananciaPorProducto(
  lineas: SaleLineForProfit[]
): { productoId: string; ganancia: number; ingresos: number; cantidad: number }[] {
  const porProducto = new Map<
    string,
    { ganancia: number; ingresos: number; cantidad: number }
  >();

  for (const linea of lineas) {
    if (!linea.producto_id) continue;
    if (linea.costo_unitario == null || !Number.isFinite(linea.costo_unitario)) {
      continue;
    }

    const ingreso = linea.subtotal - (linea.descuento ?? 0);
    const ganancia = ingreso - linea.costo_unitario * linea.cantidad;
    const acc = porProducto.get(linea.producto_id) ?? {
      ganancia: 0,
      ingresos: 0,
      cantidad: 0,
    };

    acc.ganancia += ganancia;
    acc.ingresos += ingreso;
    acc.cantidad += linea.cantidad;
    porProducto.set(linea.producto_id, acc);
  }

  return [...porProducto.entries()]
    .map(([productoId, v]) => ({
      productoId,
      ganancia: round2(v.ganancia),
      ingresos: round2(v.ingresos),
      cantidad: v.cantidad,
    }))
    .sort((a, b) => b.ganancia - a.ganancia);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
