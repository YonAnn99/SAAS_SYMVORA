/**
 * El periodo que se consulta en Reportes, y el rango de fechas que implica.
 *
 * POR QUE EXISTE. Esto vivia dentro de un `useCallback` de 977 lineas en
 * `reports/page.tsx`, junto a siete ayudantes de fecha sin exportar. Mientras
 * solo lo usaban los agregados daba igual; el historial de ventas necesita
 * EXACTAMENTE el mismo rango, y copiarlo garantizaba que los dos se separaran:
 * el listado mostrando un periodo y las graficas otro, sin que nada avisara.
 *
 * Ademas el periodo era un `string` suelto cuyos valores validos solo existian
 * escritos a mano en el JSX del desplegable. Ahora es un tipo, y la lista que
 * pinta el desplegable sale de aqui.
 *
 * Todo es logica pura y tiene test: es lo unico de Reportes que decide algo.
 */

export type Periodo = "dia" | "semana" | "mes" | "trimestre" | "ano";

/** Rango cerrado: `desde` a las 00:00 y `hasta` a las 23:59:59.999. */
export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/**
 * Las opciones del desplegable, en el orden en que se muestran.
 *
 * Vive aqui y no en el JSX para que el tipo y lo que ve el usuario no puedan
 * discrepar: anadir un periodo al tipo sin anadirlo aqui deja una opcion
 * inalcanzable, y al reves deja una opcion que revienta al elegirla.
 */
export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "semana", etiqueta: "Última semana" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "trimestre", etiqueta: "Último trimestre" },
  { valor: "ano", etiqueta: "Último año" },
  { valor: "dia", etiqueta: "Día específico" },
];

/** Para validar lo que llega del desplegable o de la URL. */
export function esPeriodo(valor: string): valor is Periodo {
  return PERIODOS.some((p) => p.valor === valor);
}

// ---------------------------------------------------------------------------
// Ayudantes de fecha
// ---------------------------------------------------------------------------

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Lunes = 0. El calendario del panel empieza la semana en lunes. */
export function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isDateAfterOrEqual(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() >= startOfDay(b).getTime();
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// El rango
// ---------------------------------------------------------------------------

/**
 * Que ventana de tiempo abarca un periodo.
 *
 * Devuelve `null` solo en un caso: periodo "dia" sin fecha elegida todavia.
 * No es un error, es que el usuario aun no ha escogido el dia en el
 * calendario; quien llama decide si no consultar nada o mostrar un aviso.
 * Antes esa rama hacia `setLoading(false); return;` desde dentro del calculo,
 * que es justo lo que impedia probarlo.
 *
 * `ahora` se recibe en vez de leerse dentro para que los test no dependan del
 * reloj de la maquina.
 */
export function rangoDePeriodo(
  periodo: Periodo,
  fechaElegida: Date | null = null,
  ahora: Date = new Date()
): RangoFechas | null {
  switch (periodo) {
    case "dia": {
      if (!fechaElegida) return null;
      return { desde: startOfDay(fechaElegida), hasta: endOfDay(fechaElegida) };
    }
    case "semana": {
      // Siete dias CONTANDO hoy, por eso 6 y no 7.
      const desde = startOfDay(ahora);
      desde.setDate(desde.getDate() - 6);
      return { desde, hasta: endOfDay(ahora) };
    }
    case "trimestre": {
      const desde = startOfDay(ahora);
      desde.setMonth(desde.getMonth() - 3);
      return { desde, hasta: endOfDay(ahora) };
    }
    case "ano": {
      const desde = startOfDay(ahora);
      desde.setFullYear(desde.getFullYear() - 1);
      return { desde, hasta: endOfDay(ahora) };
    }
    case "mes":
    default: {
      // Del dia 1 del mes en curso, no "ultimos 30 dias".
      return {
        desde: startOfDay(new Date(ahora.getFullYear(), ahora.getMonth(), 1)),
        hasta: endOfDay(ahora),
      };
    }
  }
}

/**
 * El periodo inmediatamente anterior, para la comparacion de Reportes.
 *
 * - dia: el dia anterior. semana: los 7 dias previos.
 * - mes: del dia 1 al MISMO dia del mes pasado (el 8 de octubre se compara con
 *   1-8 de septiembre, no con septiembre completo: un tramo comparable). Si el
 *   mes pasado es mas corto, se recorta a su ultimo dia (31 mar -> 28/29 feb).
 * - trimestre / ano: el mismo tramo de calendario justo antes del actual.
 */
export function rangoAnterior(periodo: Periodo, rango: RangoFechas): RangoFechas {
  const { desde, hasta } = rango;

  switch (periodo) {
    case "dia":
    case "semana": {
      const dias = periodo === "dia" ? 1 : 7;
      const nuevoDesde = startOfDay(desde);
      nuevoDesde.setDate(nuevoDesde.getDate() - dias);
      const nuevoHasta = endOfDay(hasta);
      nuevoHasta.setDate(nuevoHasta.getDate() - dias);
      return { desde: nuevoDesde, hasta: nuevoHasta };
    }
    case "mes": {
      const anio = desde.getFullYear();
      const mes = desde.getMonth() - 1;
      const inicio = new Date(anio, mes, 1);
      const dia = Math.min(hasta.getDate(), getDaysInMonth(inicio.getFullYear(), inicio.getMonth()));
      return {
        desde: startOfDay(inicio),
        hasta: endOfDay(new Date(inicio.getFullYear(), inicio.getMonth(), dia)),
      };
    }
    case "trimestre":
    case "ano":
    default: {
      const nuevoDesde = startOfDay(desde);
      if (periodo === "ano") nuevoDesde.setFullYear(nuevoDesde.getFullYear() - 1);
      else nuevoDesde.setMonth(nuevoDesde.getMonth() - 3);
      const nuevoHasta = endOfDay(desde);
      nuevoHasta.setDate(nuevoHasta.getDate() - 1);
      return { desde: nuevoDesde, hasta: nuevoHasta };
    }
  }
}
