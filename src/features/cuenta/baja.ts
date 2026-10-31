/**
 * Eliminacion de cuenta (migracion 128): lo que comparten el panel, Mi perfil y
 * la pagina publica /es/eliminar-cuenta. Puro, con test.
 */

/** Dias para arrepentirse; el mismo `INTERVAL '30 days'` de `solicitudes_baja.ejecutar_en`. */
export const DIAS_PLAZO_BAJA = 30;

export interface SolicitudBaja {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  es_dueno: boolean;
  ejecutar_en: string;
  cancelada_en: string | null;
  ejecutada_en: string | null;
}

/** «15 de noviembre de 2026», en hora de Ciudad de México. */
export function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Dias completos que faltan (0 si ya vencio). */
export function diasRestantes(iso: string, ahora: Date = new Date()): number {
  const ms = new Date(iso).getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * La solicitud que bloquea el panel de esta persona, si hay: la suya propia o,
 * si el DUEÑO pidio cerrar el negocio, la del negocio (todo el equipo la ve).
 */
export function solicitudQueBloquea(
  solicitudes: readonly SolicitudBaja[],
  userId: string,
  tenantId: string
): { solicitud: SolicitudBaja; propia: boolean } | null {
  const vivas = solicitudes.filter((s) => !s.cancelada_en && !s.ejecutada_en);
  const propia = vivas.find((s) => s.user_id === userId);
  if (propia) return { solicitud: propia, propia: true };
  const delNegocio = vivas.find((s) => s.es_dueno && s.tenant_id === tenantId);
  return delNegocio ? { solicitud: delNegocio, propia: false } : null;
}
