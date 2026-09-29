/**
 * Avisos de cobro: a quien le toca que correo hoy. Lo usa el cron diario
 * `/api/cron/avisos-cobro`. Logica pura, sin I/O, para poder probarla (mismo
 * patron que `trial-notices.ts`).
 *
 *   dia -3  renovacion    quien paga a mano (efectivo/OXXO/transferencia):
 *                         "tu mes vence el X, genera tu referencia"
 *   dia 0   gracia        fallo la tarjeta o vencio el mes: 3 dias de gracia
 *   dia 3   solo_lectura  "tu cuenta esta en solo lectura; tus datos, seguros"
 *   dia 7   regreso       oferta: primer mes de vuelta al precio promocional
 *   dia 25  ultimo        "quedan 5 dias para tu oferta y tus datos"
 *
 * (Los dias 3/7/25 se cuentan desde que entro a solo lectura.)
 *
 * Cada aviso se manda UNA vez por ciclo (marca `aviso_*_en`); el webhook borra
 * las marcas al pagar. Las pruebas gratis vencidas NO entran aqui: esas las
 * cubre `trial-notices`.
 */

import {
  DIAS_CONSERVACION_DATOS,
  calcularAcceso,
  inicioSoloLectura,
  type DatosAcceso,
} from "@/lib/acceso-suscripcion";

export type AvisoCobro = "renovacion" | "gracia" | "solo_lectura" | "regreso" | "ultimo";

export const DIAS_AVISO_RENOVACION = 3;
export const DIA_OFERTA_REGRESO = 7;
export const DIA_ULTIMO_AVISO = 25;

const MS_POR_DIA = 86_400_000;

export interface SuscripcionParaCobro extends DatosAcceso {
  last_payment_at: string | null;
  conekta_subscription_id: string | null;
  aviso_renovacion_en: string | null;
  aviso_gracia_en: string | null;
  aviso_solo_lectura_en: string | null;
  aviso_regreso_en: string | null;
  aviso_ultimo_en: string | null;
}

/** Columna que marca cada aviso como enviado. */
export function columnaAvisoCobro(tipo: AvisoCobro): keyof SuscripcionParaCobro {
  return `aviso_${tipo}_en` as keyof SuscripcionParaCobro;
}

/**
 * Solo cuentas que alguna vez pagaron (o que Conekta marco con adeudo o
 * cancelacion). Una prueba que nunca pago no recibe correos de cobro.
 */
export function esClienteDePago(sub: SuscripcionParaCobro): boolean {
  return (
    Boolean(sub.last_payment_at) || sub.estado === "past_due" || sub.estado === "canceled"
  );
}

/** Dias enteros transcurridos en solo lectura (0 el primer dia). */
export function diasEnSoloLectura(sub: SuscripcionParaCobro, ahora: Date): number | null {
  const desde = inicioSoloLectura(sub, ahora);
  if (!desde) return null;
  return Math.floor((ahora.getTime() - desde.getTime()) / MS_POR_DIA);
}

export function avisoCobroPendiente(
  sub: SuscripcionParaCobro,
  ahora: Date = new Date()
): AvisoCobro | null {
  if (!esClienteDePago(sub)) return null;

  const acceso = calcularAcceso(sub, ahora);

  if (acceso === "completo") {
    // Aviso previo solo a quien paga a mano: con tarjeta el cobro es solo, y
    // quien cancelo decidio irse (no se le insiste antes de tiempo).
    if (sub.estado !== "active" || sub.conekta_subscription_id) return null;
    if (sub.aviso_renovacion_en || !sub.current_period_end) return null;
    const faltan = (new Date(sub.current_period_end).getTime() - ahora.getTime()) / MS_POR_DIA;
    return faltan > 0 && faltan <= DIAS_AVISO_RENOVACION ? "renovacion" : null;
  }

  if (acceso === "gracia") {
    return sub.aviso_gracia_en ? null : "gracia";
  }

  const dias = diasEnSoloLectura(sub, ahora);
  if (dias === null || dias >= DIAS_CONSERVACION_DATOS) return null;
  if (dias >= DIA_ULTIMO_AVISO) return sub.aviso_ultimo_en ? null : "ultimo";
  if (dias >= DIA_OFERTA_REGRESO) return sub.aviso_regreso_en ? null : "regreso";
  // Si el cron no corrio a tiempo no se manda un "acabas de pasar a solo
  // lectura" con una semana de retraso: el de la oferta ya lo explica.
  return sub.aviso_solo_lectura_en ? null : "solo_lectura";
}
