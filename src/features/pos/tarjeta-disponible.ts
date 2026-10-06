/**
 * ¿Se puede registrar un cobro con «Tarjeta» (el manual)?
 *
 * «Tarjeta» registra una venta que se cobró en una terminal aparte. Sin
 * terminal no hay con qué cobrar, así que el botón queda bloqueado hasta que
 * exista alguna:
 *
 * - Mercado Pago Point lista (`mpReady`, la misma que habilita «Tarjeta
 *   (terminal)»), o
 * - una terminal NO integrada (banco, Clip, Getnet…) que el negocio declara en
 *   Configuración → Métodos de pago (`pos_config.terminal_externa`). Esas no
 *   se pueden detectar: por eso se declaran.
 *
 * En el demo siempre está disponible: no se esconde la función a quien la
 * prueba.
 *
 * `null` = todavía cargando alguno de los dos y ninguno dijo que sí: el botón
 * se ve bloqueado, igual que «Tarjeta (terminal)» mientras carga.
 */
export function tarjetaManualDisponible(estado: {
  mpReady: boolean | null;
  terminalExterna: boolean | null;
  esDemo: boolean;
}): boolean | null {
  if (estado.esDemo || estado.mpReady === true || estado.terminalExterna === true) return true;
  if (estado.mpReady === null || estado.terminalExterna === null) return null;
  return false;
}
