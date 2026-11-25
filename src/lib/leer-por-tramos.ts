/**
 * Lectura de TODAS las filas de una consulta de Supabase, por tramos.
 *
 * PostgREST (Supabase) responde como MÁXIMO 1,000 filas por petición y no avisa: el
 * encabezado dice `content-range: 0-999/*` y la lista simplemente llega cortada. Un negocio
 * con más de 1,000 productos veía el catálogo (y el stock por sucursal) incompleto, sin
 * ningún error: productos que no aparecían en el POS o salían sin existencias.
 *
 * Uso:
 *   const filas = await leerPorTramos<Fila>((desde, hasta) =>
 *     supabase.from("productos").select("*").eq("tenant_id", id).order("nombre").order("id").range(desde, hasta)
 *   );
 *
 * REGLAS DE QUIEN LLAMA:
 *   - La consulta lleva un orden ESTABLE (el campo que se quiera + `id` como desempate). Con un
 *     orden no único, dos tramos pueden repetir o saltarse filas.
 *   - Si algún tramo falla, se lanza el error: nunca se devuelve una lista a medias como si
 *     estuviera completa.
 *
 * El primer tramo va solo: la mayoría de los negocios caben en él y no pagan peticiones de más. Solo
 * si llega lleno se piden los demás, por oleadas (`paralelas`, 3 por defecto; el pool de PostgREST
 * del plan gratuito es chico).
 */

/** Tope de filas que devuelve PostgREST por petición (`max-rows` de Supabase). */
export const FILAS_POR_TRAMO = 1000;

/** Freno de seguridad: 500 tramos = 500,000 filas. Más que eso es un error, no un catálogo. */
const MAX_TRAMOS = 500;

interface RespuestaTramo<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface OpcionesTramos {
  /** Filas por petición. Nunca más que el tope de PostgREST. */
  tramo?: number;
  /** Cuántos tramos se piden a la vez después del primero. */
  paralelas?: number;
  /**
   * Tope de filas a devolver (los reportes se agregan en el navegador y no pueden traer
   * un año de historial). Con la consulta ordenada, lo que se conserva es lo primero.
   * Quien lo use compara `filas.length >= maximo` para avisar que se truncó.
   */
  maximo?: number;
}

export async function leerPorTramos<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<RespuestaTramo<T>>,
  opciones: OpcionesTramos = {}
): Promise<T[]> {
  const tramo = Math.max(1, Math.min(opciones.tramo ?? FILAS_POR_TRAMO, FILAS_POR_TRAMO));
  const paralelas = Math.max(1, opciones.paralelas ?? 3);

  const leer = async (pagina: number): Promise<T[]> => {
    const respuesta = await pedir(pagina * tramo, pagina * tramo + tramo - 1);
    if (respuesta.error) throw respuesta.error;
    return respuesta.data ?? [];
  };

  const maximo = opciones.maximo;
  const primero = await leer(0);
  if (maximo !== undefined && primero.length >= maximo) return primero.slice(0, maximo);
  if (primero.length < tramo) return primero;

  const filas: T[] = [...primero];
  for (let desde = 1; desde < MAX_TRAMOS; desde += paralelas) {
    const paginas = Array.from(
      { length: Math.min(paralelas, MAX_TRAMOS - desde) },
      (_, i) => desde + i
    );
    const resultados = await Promise.all(paginas.map(leer));
    for (const lote of resultados) {
      for (const fila of lote) filas.push(fila);
      if (maximo !== undefined && filas.length >= maximo) return filas.slice(0, maximo);
      // Un tramo corto es el último: los siguientes de la oleada vienen vacíos.
      if (lote.length < tramo) return filas;
    }
  }
  throw new Error("La consulta devolvió más tramos de los permitidos");
}
