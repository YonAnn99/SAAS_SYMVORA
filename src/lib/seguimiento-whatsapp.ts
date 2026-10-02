/**
 * Seguimiento por WhatsApp de quien se queda a medias. Decide A QUIEN le toca
 * cada mensaje; el cron `api/cron/seguimiento-whatsapp` solo consulta, envia
 * y marca. Puro, para probar las ventanas sin base ni reloj.
 *
 * Tres flujos (el plan de recuperacion de onboarding, adaptado al sistema):
 *   1. Registro abandonado: dejo nombre, negocio y celular en "Crear cuenta"
 *      (`registros_pendientes`) y no termino en 2 horas.
 *   2. Onboarding atascado: lleva 48 h en prueba con 0 productos o 0 ventas.
 *   3. Pago abandonado: abrio el pago en /billing y no lo completo en 12 h.
 *
 * Cada mensaje sale UNA vez (marcas en la base) y hay techos para no escribir
 * a destiempo: un borrador de hace una semana ya no es "¿tuviste algun
 * problema?", es spam.
 */

const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

export const HORAS_REGISTRO_ABANDONADO = 2;
/** Despues de esto el borrador ya no se contacta (y se borra a los 30 dias). */
export const DIAS_MAX_REGISTRO_ABANDONADO = 3;
export const DIAS_LIMPIEZA_BORRADORES = 30;

export const HORAS_ONBOARDING_ATASCADO = 48;
/** Pasada la prueba (14 dias) ya no tiene sentido ofrecer ayuda para empezar. */
export const DIAS_MAX_ONBOARDING_ATASCADO = 14;

export const HORAS_PAGO_ABANDONADO = 12;
export const HORAS_MAX_PAGO_ABANDONADO = 48;
/** Aunque reintente el pago cada dia, a lo mas un recordatorio por semana. */
export const DIAS_ENTRE_AVISOS_PAGO = 7;

const fecha = (v: string | Date | null | undefined): Date | null =>
  v ? (v instanceof Date ? v : new Date(v)) : null;

// ---------------------------------------------------------------------------
// 1. Registro abandonado
// ---------------------------------------------------------------------------

export interface BorradorRegistro {
  estado: string;
  whatsapp_enviado_en: string | Date | null;
  actualizado_en: string | Date;
}

export function tocaRegistroAbandonado(b: BorradorRegistro, ahora: Date): boolean {
  if (b.estado !== "borrador" || b.whatsapp_enviado_en) return false;
  const edad = ahora.getTime() - fecha(b.actualizado_en)!.getTime();
  return edad >= HORAS_REGISTRO_ABANDONADO * MS_POR_HORA && edad <= DIAS_MAX_REGISTRO_ABANDONADO * MS_POR_DIA;
}

// ---------------------------------------------------------------------------
// 2. Onboarding atascado
// ---------------------------------------------------------------------------

export interface NegocioEnPrueba {
  status: string;
  aviso_onboarding_en: string | Date | null;
  /** `tenants.creado_en`. */
  creado_en: string | Date;
  productos: number;
  ventas: number;
}

export function tocaOnboardingAtascado(n: NegocioEnPrueba, ahora: Date): boolean {
  if (n.status !== "trial" || n.aviso_onboarding_en) return false;
  if (n.productos > 0 && n.ventas > 0) return false;
  const edad = ahora.getTime() - fecha(n.creado_en)!.getTime();
  return edad >= HORAS_ONBOARDING_ATASCADO * MS_POR_HORA && edad <= DIAS_MAX_ONBOARDING_ATASCADO * MS_POR_DIA;
}

// ---------------------------------------------------------------------------
// 3. Pago abandonado
// ---------------------------------------------------------------------------

export interface IntentoDePago {
  status: string;
  checkout_iniciado_en: string | Date | null;
  aviso_pago_abandonado_en: string | Date | null;
  last_payment_at: string | Date | null;
}

export function tocaPagoAbandonado(s: IntentoDePago, ahora: Date): boolean {
  const intento = fecha(s.checkout_iniciado_en);
  if (!intento || s.status === "active") return false;

  // Pago despues del intento: lo completo (el webhook a veces tarda en
  // cambiar el estado, pero `last_payment_at` ya lo dice).
  const pago = fecha(s.last_payment_at);
  if (pago && pago >= intento) return false;

  const edad = ahora.getTime() - intento.getTime();
  if (edad < HORAS_PAGO_ABANDONADO * MS_POR_HORA || edad > HORAS_MAX_PAGO_ABANDONADO * MS_POR_HORA) {
    return false;
  }

  // Una vez por intento y, aun con varios intentos, no mas de uno por semana.
  const aviso = fecha(s.aviso_pago_abandonado_en);
  if (!aviso) return true;
  return aviso < intento && ahora.getTime() - aviso.getTime() >= DIAS_ENTRE_AVISOS_PAGO * MS_POR_DIA;
}
