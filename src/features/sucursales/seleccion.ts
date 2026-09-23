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

/**
 * A que local va una operacion (compra, orden, ajuste) si nadie dice otra cosa.
 *
 * 1. La sucursal que el usuario tiene elegida en el selector: si esta mirando
 *    Norte y registra una compra, lo natural es que entre en Norte.
 * 2. Si solo hay un local abierto, ese: no hay nada que preguntar.
 * 3. Si hay varios y esta en "Todas", NINGUNO (`null`): el formulario obliga a
 *    elegir. Adivinar aqui mandaria mercancia al local equivocado, y un error de
 *    inventario no se nota hasta que un producto "desaparece" en un mostrador.
 *
 * Una sucursal cerrada nunca es destino por defecto, aunque este elegida para
 * consultar su historico.
 */
export function destinoPorDefecto(
  seleccionada: string | null,
  activas: readonly { id: string }[]
): string | null {
  if (seleccionada && activas.some((s) => s.id === seleccionada)) {
    return seleccionada;
  }
  if (activas.length === 1) return activas[0].id;
  return null;
}
