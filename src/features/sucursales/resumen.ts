/**
 * La comparativa de locales del modulo de Sucursales.
 *
 * Pura a proposito: recibe filas ya traidas y devuelve una fila por sucursal
 * mas el total. Asi la regla que mas importa —que el total del negocio sea la
 * SUMA de sus locales, ni mas ni menos— se prueba sin base de datos.
 */

export interface VentaResumen {
  sucursal_id: string | null;
  total: number;
}

export interface StockResumen {
  sucursal_id: string;
  cantidad: number;
}

export interface CajaResumen {
  sucursal_id: string | null;
  estado: "ABIERTA" | "CERRADA";
  /** Sobrante (+) o faltante (-) del corte. Solo cuenta en cajas cerradas. */
  diferencia: number | null;
}

export interface FilaResumen {
  sucursalId: string | null;
  nombre: string;
  activa: boolean;
  ventas: number;
  tickets: number;
  ticketPromedio: number;
  unidades: number;
  cajasAbiertas: number;
  diferenciaCortes: number;
}

function vacia(id: string | null, nombre: string, activa: boolean): FilaResumen {
  return {
    sucursalId: id,
    nombre,
    activa,
    ventas: 0,
    tickets: 0,
    ticketPromedio: 0,
    unidades: 0,
    cajasAbiertas: 0,
    diferenciaCortes: 0,
  };
}

/**
 * Una fila por sucursal (en el orden recibido), mas una de "Sin sucursal" SOLO
 * si hay ventas o cajas que no apuntan a ninguna, y el total.
 *
 * LA FILA "SIN SUCURSAL" NO ES DECORATIVA. Si hubiera ventas sin local y se
 * descartaran, la suma de las filas no daria el total del negocio y la
 * comparativa mentiria por omision. Se enseñan aparte para que cuadre.
 */
export function resumenPorSucursal(
  sucursales: readonly { id: string; nombre: string; activa: boolean }[],
  ventas: readonly VentaResumen[],
  stock: readonly StockResumen[],
  cajas: readonly CajaResumen[]
): { filas: FilaResumen[]; total: FilaResumen } {
  const porId = new Map<string, FilaResumen>();
  for (const s of sucursales) porId.set(s.id, vacia(s.id, s.nombre, s.activa));
  const huerfana = vacia(null, "Sin sucursal", true);

  const fila = (id: string | null) => (id && porId.get(id)) || huerfana;

  for (const v of ventas) {
    const f = fila(v.sucursal_id);
    f.ventas += Number(v.total) || 0;
    f.tickets += 1;
  }
  for (const s of stock) {
    const f = porId.get(s.sucursal_id);
    if (f) f.unidades += Number(s.cantidad) || 0;
  }
  for (const c of cajas) {
    const f = fila(c.sucursal_id);
    if (c.estado === "ABIERTA") f.cajasAbiertas += 1;
    else f.diferenciaCortes += Number(c.diferencia) || 0;
  }

  const filas = [...porId.values()];
  if (huerfana.tickets > 0 || huerfana.cajasAbiertas > 0 || huerfana.diferenciaCortes !== 0) {
    filas.push(huerfana);
  }

  const total = vacia(null, "Todo el negocio", true);
  for (const f of filas) {
    total.ventas += f.ventas;
    total.tickets += f.tickets;
    total.unidades += f.unidades;
    total.cajasAbiertas += f.cajasAbiertas;
    total.diferenciaCortes += f.diferenciaCortes;
  }

  for (const f of [...filas, total]) {
    f.ticketPromedio = f.tickets > 0 ? f.ventas / f.tickets : 0;
  }

  return { filas, total };
}
