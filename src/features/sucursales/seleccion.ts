/**
 * Que sucursal queda elegida al cargar la pantalla.
 *
 * Parece de adorno y no lo es: la eleccion se recuerda en `localStorage`, que
 * SOBREVIVE a cosas que el identificador guardado no. Si se filtrara por un id
 * que ya no existe, el panel saldria **a cero sin decir por que** — y a cero es
 * un numero creible, asi que nadie sospecharia de un fallo. Tres formas de
 * llegar ahi, todas reales:
 *
 *   - la sucursal se borro;
 *   - el usuario cerro sesion y entro con otra cuenta, de otro negocio, en el
 *     mismo navegador;
 *   - el navegador es compartido, que en un mostrador es lo normal.
 *
 * Ante la duda se vuelve a "todas" (`null`): ensenar de mas un consolidado que
 * el usuario ya podia ver es inofensivo; ensenar un cero falso no lo es.
 */
export function resolverSeleccion(
  guardada: string | null,
  sucursales: readonly { id: string }[]
): string | null {
  if (!guardada) return null;
  return sucursales.some((s) => s.id === guardada) ? guardada : null;
}
