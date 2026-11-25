/**
 * A quién le toca cada correo de ACTIVACIÓN de una cuenta nueva (`/api/cron/activacion`). Puro, como
 * `trial-notices.ts` y `seguimiento-whatsapp.ts`: el cron consulta, envía y marca; aquí solo se decide.
 *
 * Por qué existe: en las cuentas reales, 12 de 13 pruebas vigentes no tenían productos ni ventas, y entre el
 * registro y el aviso de fin de prueba no salía ningún mensaje. Quien arranca lo hace rápido (mediana ~2 h al
 * primer producto), así que el seguimiento tiene que ser pronto y breve.
 *
 * Tres correos como máximo por cuenta, nunca dos con menos de 36 h de diferencia, y VENTANAS de edad: una cuenta
 * vieja no recibe «bienvenida a tu primer producto» (eso sería spam). Las cuentas viejas sin actividad se atienden
 * con la reactivación manual (`/api/cron/reactivar-pruebas`).
 */

export type EtapaActivacion = "primer_producto" | "primera_venta" | "ayuda";

export const ETAPAS_ACTIVACION: readonly EtapaActivacion[] = ["primer_producto", "primera_venta", "ayuda"];

const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Edad de la cuenta (desde que se registró) en la que cada correo puede salir. */
export const VENTANAS_ACTIVACION: Record<EtapaActivacion, { desdeHoras: number; hastaDias: number }> = {
  primer_producto: { desdeHoras: 20, hastaDias: 5 },
  primera_venta: { desdeHoras: 48, hastaDias: 9 },
  ayuda: { desdeHoras: 96, hastaDias: 10 },
};

export const MAX_CORREOS_ACTIVACION = 3;
export const HORAS_ENTRE_CORREOS_ACTIVACION = 36;

export interface CorreoDeActivacionEnviado {
  etapa: EtapaActivacion;
  en: string | Date;
}

export interface CuentaParaActivacion {
  /** `subscriptions.status`. */
  status: string;
  /** Negocio de demo (`tenants.demo_expira_en`). */
  esDemo: boolean;
  /** Ya hubo un pago (`subscriptions.last_payment_at`). */
  pago: boolean;
  /** `tenants.creado_en`. */
  creadaEn: string | Date;
  /** `subscriptions.trial_end`. */
  trialEnd: string | Date;
  /** Productos activos (no archivados). */
  productos: number;
  /** Ventas de cualquier estado: si ya intentó vender, salió del embudo. */
  ventas: number;
  /** Correos de activación que ya salieron a esta cuenta. */
  enviados: CorreoDeActivacionEnviado[];
}

const fecha = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

/** ¿Aplica la etapa a esta cuenta por lo que ya hizo? */
function aplica(etapa: EtapaActivacion, productos: number): boolean {
  if (etapa === "primer_producto") return productos === 0;
  if (etapa === "primera_venta") return productos > 0;
  return true; // «ayuda»: cualquiera que siga sin vender
}

/** El correo que le toca ahora, o `null` si ninguno. */
export function etapaPendiente(c: CuentaParaActivacion, ahora: Date): EtapaActivacion | null {
  // Solo pruebas vivas de negocios reales que aún no venden ni pagan.
  if (c.status !== "trial" || c.esDemo || c.pago || c.ventas > 0) return null;
  if (fecha(c.trialEnd).getTime() <= ahora.getTime()) return null;

  if (c.enviados.length >= MAX_CORREOS_ACTIVACION) return null;
  const ultimo = c.enviados.reduce<number>((m, e) => Math.max(m, fecha(e.en).getTime()), 0);
  if (ultimo && ahora.getTime() - ultimo < HORAS_ENTRE_CORREOS_ACTIVACION * MS_POR_HORA) return null;

  const edad = ahora.getTime() - fecha(c.creadaEn).getTime();
  const yaEnviadas = new Set(c.enviados.map((e) => e.etapa));

  for (const etapa of ETAPAS_ACTIVACION) {
    if (yaEnviadas.has(etapa) || !aplica(etapa, c.productos)) continue;
    const v = VENTANAS_ACTIVACION[etapa];
    if (edad >= v.desdeHoras * MS_POR_HORA && edad <= v.hastaDias * MS_POR_DIA) return etapa;
  }
  return null;
}

/** Clave de `consumirRateLimit` (y de la marca en `rate_limits`) de un correo de activación. */
export function claveActivacion(etapa: EtapaActivacion, tenantId: string): string {
  return `activacion:${etapa}:${tenantId}`;
}

/** Saca (etapa, tenant) de una clave de `claveActivacion`; null si no es de activación. */
export function leerClaveActivacion(clave: string): { etapa: EtapaActivacion; tenantId: string } | null {
  const m = /^activacion:(primer_producto|primera_venta|ayuda):([0-9a-f-]{36})$/.exec(clave);
  return m ? { etapa: m[1] as EtapaActivacion, tenantId: m[2] } : null;
}

// ---------------------------------------------------------------------------
// Reactivación de pruebas vencidas que nunca probaron la app (campaña manual)
// ---------------------------------------------------------------------------

/** Días de prueba que se regalan al reactivar y al primer cobro. */
export const DIAS_PRUEBA_REGALADOS = 7;
/** Una prueba vencida hace más que esto ya no se reactiva. */
export const DIAS_MAX_REACTIVAR = 90;

export interface CuentaParaReactivar {
  status: string;
  esDemo: boolean;
  pago: boolean;
  creadaEn: string | Date;
  trialEnd: string | Date;
  productos: number;
  ventas: number;
  /** Ya se le reactivó una vez (marca en `rate_limits`). */
  yaReactivada: boolean;
}

/** ¿Se le regalan días a esta cuenta? Prueba vencida, nunca pagó y NUNCA cargó un producto ni vendió. */
export function sePuedeReactivar(c: CuentaParaReactivar, ahora: Date): boolean {
  if (c.status !== "trial" || c.esDemo || c.pago || c.yaReactivada) return false;
  if (c.productos > 0 || c.ventas > 0) return false;
  if (fecha(c.trialEnd).getTime() > ahora.getTime()) return false; // aún en prueba: no hace falta
  return ahora.getTime() - fecha(c.creadaEn).getTime() <= DIAS_MAX_REACTIVAR * MS_POR_DIA;
}
