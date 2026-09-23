/**
 * Existencias de UN local sobre una lista de productos del negocio.
 *
 * El catalogo es comun (un solo "Coca 600ml"), pero las unidades viven por
 * sucursal en `stock_sucursal` (migracion 078). Las pantallas que hoy leen
 * `productos.stock_actual` —el total del negocio— necesitan, cuando se mira un
 * local concreto, ver lo que hay EN ESE local. En vez de reescribir cada
 * pantalla, se sustituye el numero en los datos y todo lo que ya sabe pintar
 * `stock_actual` (colores de stock bajo, orden por existencias, el filtro que
 * esconde lo agotado del punto de venta) funciona solo.
 *
 * Es la MISMA funcion para el punto de venta, Productos y el modulo de
 * sucursales a proposito: tres copias de esta regla divergirian, y el sintoma
 * seria que el POS dijera "hay 3" mientras la venta falla con "Disponible: 0".
 */

export interface FilaStockSucursal {
  producto_id: string;
  /** `null` = el stock "sin clasificar" del producto, no una variante. */
  variante_id: string | null;
  cantidad: number;
  se_vende: boolean;
}

function clave(productoId: string, varianteId: string | null): string {
  return `${productoId}:${varianteId ?? ""}`;
}

export function indexarStock(
  filas: readonly FilaStockSucursal[]
): Map<string, FilaStockSucursal> {
  const mapa = new Map<string, FilaStockSucursal>();
  for (const f of filas) mapa.set(clave(f.producto_id, f.variante_id), f);
  return mapa;
}

/**
 * Productos con `stock_actual` = lo que hay en el local, y `se_vende`.
 *
 * SIN FILA = CERO, no "lo que diga el total". Un producto que nunca ha pisado
 * Norte no tiene existencias en Norte, aunque en Principal sobren; enseñar el
 * total ahi es justo el error que esta funcion existe para evitar.
 *
 * `se_vende` por defecto es `true`: el interruptor nace encendido y solo se
 * apaga a proposito.
 */
export function conStockDeSucursal<T extends { id: string; stock_actual: number }>(
  productos: readonly T[],
  filas: readonly FilaStockSucursal[]
): Array<T & { se_vende: boolean }> {
  const idx = indexarStock(filas);
  return productos.map((p) => {
    const fila = idx.get(clave(p.id, null));
    return {
      ...p,
      stock_actual: Number(fila?.cantidad ?? 0),
      se_vende: fila?.se_vende ?? true,
    };
  });
}

/** Lo mismo para variantes: cada talla/color tiene su propia fila por local. */
export function conStockDeSucursalVariantes<
  T extends { id: string; producto_id: string; stock_actual: number },
>(variantes: readonly T[], filas: readonly FilaStockSucursal[]): T[] {
  const idx = indexarStock(filas);
  return variantes.map((v) => ({
    ...v,
    stock_actual: Number(idx.get(clave(v.producto_id, v.id))?.cantidad ?? 0),
  }));
}

/**
 * Lo que el mostrador de un local puede ofrecer: lo que tiene existencias ahi,
 * mas los servicios (que no tienen existencias nunca y aun asi se cobran,
 * migracion 075), y nada de lo que el local marco como "no se vende aqui".
 *
 * Es la misma regla que aplica la base al cobrar (`se_vende_en` y la validacion
 * de stock de `_crear_venta_desde_items`). Si la pantalla enseñara algo que la
 * venta luego rechaza, el cajero lo descubriria con el cliente delante.
 */
export function vendiblesEnLocal<
  T extends { stock_actual: number; es_servicio?: boolean | null; se_vende: boolean },
>(productos: readonly T[]): T[] {
  return productos.filter(
    (p) => p.se_vende && (Number(p.stock_actual) > 0 || Boolean(p.es_servicio))
  );
}

export type DestinoEdicionStock =
  /** Un solo local: el camino de siempre, sin preguntar nada. */
  | { tipo: "negocio" }
  /** Varios locales y uno elegido: la edicion es sobre ESE local. */
  | { tipo: "sucursal"; sucursalId: string }
  /** Varios locales en "Todas": no hay local sobre el que editar. */
  | { tipo: "bloqueado"; motivo: string };

export const MOTIVO_ELIGE_SUCURSAL =
  "Elige una sucursal en el selector para editar sus existencias. Con «Todas» ves el total del negocio, y no se sabría en qué local cambiarlo.";

/**
 * Sobre que local cae una edicion de existencias hecha en la tabla o en el
 * dialogo de producto.
 *
 * EL CASO QUE IMPORTA ES EL BLOQUEO. Con "Todas" la pantalla enseña el TOTAL
 * del negocio (40 = 25 en Centro + 15 en Norte). Si el usuario lo cambia a 30,
 * la diferencia (-10) no tiene local: aplicarla al de por defecto dejaria
 * Centro en 15 cuando quiza el que se vendio era Norte. Esa cuenta no tiene
 * respuesta correcta, asi que no se hace: se pide elegir el local.
 */
export function destinoDeEdicionDeStock(
  hayVarias: boolean,
  seleccionada: string | null
): DestinoEdicionStock {
  if (!hayVarias) return { tipo: "negocio" };
  if (seleccionada) return { tipo: "sucursal", sucursalId: seleccionada };
  return { tipo: "bloqueado", motivo: MOTIVO_ELIGE_SUCURSAL };
}
