/**
 * Series de las graficas de Reportes. Logica pura: recibe las ventas (y su
 * detalle) que Reportes ya cargo y devuelve lo que pinta cada grafica.
 *
 * `groupSalesByPeriod` y los `generate*Slots` vivian sin exportar dentro de
 * `reports/page.tsx`; se movieron aqui sin cambiar su resultado para poder
 * reutilizar las cubetas (ingresos vs ganancia usa las mismas) y probarlas.
 *
 * Las horas y dias salen de la zona horaria del navegador, igual que siempre
 * en Reportes.
 */
import { startOfDay } from "@/lib/periodo";
import { calcularGanancia, type SaleLineForProfit } from "@/lib/profit";

export type Agrupacion = "hour" | "day" | "week" | "month";

interface VentaParaSerie {
  fecha_venta: string;
  total: number;
}

// ---------------------------------------------------------------------------
// Cubetas de tiempo
// ---------------------------------------------------------------------------

function generateHourSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

function generateDaySlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = startOfDay(start);
  const last = startOfDay(end);
  while (current.getTime() <= last.getTime()) {
    slots.push(
      current.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })
    );
    current.setDate(current.getDate() + 1);
  }
  return slots;
}

function generateWeekSlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = startOfDay(start);
  const last = startOfDay(end);
  while (current.getTime() <= last.getTime()) {
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - current.getDay() + (current.getDay() === 0 ? -6 : 1));
    const key = weekStart.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    });
    if (!slots.includes(key)) {
      slots.push(key);
    }
    current.setDate(current.getDate() + 1);
  }
  return slots;
}

function generateMonthSlots(start: Date, end: Date): string[] {
  const slots: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (current.getTime() <= last.getTime()) {
    slots.push(
      current.toLocaleDateString("es-MX", { month: "short", year: "numeric" })
    );
    current.setMonth(current.getMonth() + 1);
  }
  return slots;
}

/** Etiqueta de la cubeta a la que pertenece una fecha. */
function claveDeCubeta(date: Date, groupBy: Agrupacion): string {
  if (groupBy === "hour") {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  }
  if (groupBy === "day") {
    return date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
  }
  if (groupBy === "week") {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + mondayOffset);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
}

function cubetas(startDate: Date, endDate: Date, groupBy: Agrupacion): string[] {
  if (groupBy === "hour") return generateHourSlots();
  if (groupBy === "day") return generateDaySlots(startDate, endDate);
  if (groupBy === "week") return generateWeekSlots(startDate, endDate);
  return generateMonthSlots(startDate, endDate);
}

/** Como agrupar segun el periodo y el largo del rango (regla de Reportes). */
export function agrupacionDe(esDia: boolean, desde: Date, hasta: Date): Agrupacion {
  if (esDia) return "hour";
  const dias = Math.ceil((hasta.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 7) return "day";
  if (dias <= 90) return "week";
  return "month";
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export function groupSalesByPeriod(
  ventas: VentaParaSerie[],
  startDate: Date,
  endDate: Date,
  groupBy: Agrupacion
): { date: string; ventas: number }[] {
  const salesMap = new Map<string, number>();
  ventas.forEach((v) => {
    const key = claveDeCubeta(new Date(v.fecha_venta), groupBy);
    salesMap.set(key, (salesMap.get(key) || 0) + v.total);
  });

  return cubetas(startDate, endDate, groupBy).map((slot) => ({
    date: slot,
    ventas: salesMap.get(slot) || 0,
  }));
}

/** Total y numero de ventas por hora del dia (00:00 a 23:00), sumando todo el periodo. */
export function ventasPorHora(
  ventas: VentaParaSerie[]
): { hora: string; total: number; ventas: number }[] {
  const filas = generateHourSlots().map((hora) => ({ hora, total: 0, ventas: 0 }));
  for (const v of ventas) {
    const fila = filas[new Date(v.fecha_venta).getHours()];
    fila.total += v.total;
    fila.ventas += 1;
  }
  return filas;
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Total y numero de ventas por dia de la semana, de lunes a domingo. */
export function ventasPorDiaSemana(
  ventas: VentaParaSerie[]
): { dia: string; total: number; ventas: number }[] {
  const filas = DIAS_SEMANA.map((dia) => ({ dia, total: 0, ventas: 0 }));
  for (const v of ventas) {
    const domingoCero = new Date(v.fecha_venta).getDay();
    const fila = filas[(domingoCero + 6) % 7];
    fila.total += v.total;
    fila.ventas += 1;
  }
  return filas;
}

interface LineaConVenta extends SaleLineForProfit {
  venta_id: string;
}

/**
 * Ingresos (sin IVA) y ganancia por cubeta de tiempo. Cada linea cae en la
 * cubeta de la fecha de SU venta y se calcula con `calcularGanancia`: misma
 * regla que la tarjeta de ganancia (las lineas sin costo no entran), asi que
 * la suma de la serie cuadra con ella.
 */
export function ingresosYGananciaPorPeriodo(
  ventas: Array<VentaParaSerie & { id: string }>,
  detalle: LineaConVenta[],
  startDate: Date,
  endDate: Date,
  groupBy: Agrupacion
): { date: string; ingresos: number; ganancia: number }[] {
  const cubetaDeVenta = new Map<string, string>();
  for (const v of ventas) {
    cubetaDeVenta.set(v.id, claveDeCubeta(new Date(v.fecha_venta), groupBy));
  }

  const lineasPorCubeta = new Map<string, LineaConVenta[]>();
  for (const linea of detalle) {
    const clave = cubetaDeVenta.get(linea.venta_id);
    if (!clave) continue;
    const lista = lineasPorCubeta.get(clave);
    if (lista) lista.push(linea);
    else lineasPorCubeta.set(clave, [linea]);
  }

  return cubetas(startDate, endDate, groupBy).map((slot) => {
    const resumen = calcularGanancia(lineasPorCubeta.get(slot) ?? []);
    return { date: slot, ingresos: resumen.ingresos, ganancia: resumen.ganancia };
  });
}

/**
 * Alinea la serie del periodo anterior con la actual POR POSICION (primer dia
 * con primer dia...): las etiquetas no coinciden ("lun 6" vs "lun 29"). Si el
 * anterior tiene menos cubetas se rellena con 0; si tiene mas, se recorta.
 */
export function alinearComparacion(largoActual: number, anterior: number[]): number[] {
  return Array.from({ length: largoActual }, (_, i) => anterior[i] ?? 0);
}

/**
 * Ventas sin IVA por categoria (`subtotal − descuento`, lo realmente cobrado),
 * de TODAS las lineas del periodo. Antes salian solo de los 10 productos mas
 * vendidos y buscando el producto por nombre: dos productos con el mismo nombre
 * se confundian y el resto de las ventas no aparecia.
 *
 * Las primeras `maximo` categorias van solas y el resto se junta en "Otras",
 * asi la dona suma el total del periodo.
 */
export function ventasPorCategoria(
  detalle: Array<{ producto_id: string; subtotal: number; descuento: number }>,
  productos: Array<{ id: string; categoria: string | null }>,
  maximo = 5
): { name: string; value: number }[] {
  const categoriaDe = new Map(productos.map((p) => [p.id, p.categoria?.trim() || ""]));

  const porCategoria = new Map<string, number>();
  for (const linea of detalle) {
    const categoria = categoriaDe.get(linea.producto_id) || "Sin categoría";
    const monto = linea.subtotal - (linea.descuento ?? 0);
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + monto);
  }

  const redondear = (n: number) => Math.round(n * 100) / 100;
  const ordenadas = [...porCategoria.entries()]
    .map(([name, value]) => ({ name, value: redondear(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  if (ordenadas.length <= maximo) return ordenadas;

  const resto = ordenadas.slice(maximo).reduce((suma, c) => suma + c.value, 0);
  return [...ordenadas.slice(0, maximo), { name: "Otras", value: redondear(resto) }];
}
