/**
 * Acceso de la cuenta segun su estado de pago.
 *
 * ESPEJO de `public.acceso_tenant()` (migracion 096). La base es la que
 * manda — recorta permisos y bloquea escrituras —; esta copia solo sirve para
 * la interfaz: el aviso del panel, los dias que quedan y los correos. Si se
 * cambia la regla, se cambia en los dos lados (hay test de cada caso).
 *
 *   completo      trial vigente; active dentro de su periodo (o sin fecha);
 *                 canceled antes de `current_period_end` (ya lo pago)
 *   gracia        3 dias tras fallar el cobro o vencer el periodo
 *   solo_lectura  despues: ve y exporta, no vende ni edita
 */

export type Acceso = "completo" | "gracia" | "solo_lectura";

export const DIAS_GRACIA_PAGO = 3;
/** Dias para descargar la informacion tras perder el acceso (Terminos, sec. 6). */
export const DIAS_CONSERVACION_DATOS = 30;

/** Lo que conserva una cuenta en solo lectura (igual que `permisos_solo_lectura()`). */
export const PERMISOS_SOLO_LECTURA = [
  "inventory.view",
  "sales.view_all",
  "sales.view_reports",
  "activity.view",
  "billing.view",
  "subscription.manage",
] as const;

const MS_POR_DIA = 86_400_000;

export interface DatosAcceso {
  /** `tenants.subscription_status` */
  estado: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  past_due_desde: string | null;
  /** `subscriptions.updated_at`: respaldo si falta `past_due_desde`. */
  updated_at?: string | null;
}

const fecha = (v: string | null | undefined) => (v ? new Date(v) : null);
const masDias = (d: Date, dias: number) => new Date(d.getTime() + dias * MS_POR_DIA);

/**
 * Desde cuando cuenta la gracia (o `null` si el estado no tiene gracia).
 * El fin de la gracia es este momento + `DIAS_GRACIA_PAGO`.
 */
export function inicioGracia(d: DatosAcceso, ahora: Date = new Date()): Date | null {
  if (d.estado === "past_due") {
    return fecha(d.past_due_desde) ?? fecha(d.updated_at) ?? ahora;
  }
  if (d.estado === "active") {
    const fin = fecha(d.current_period_end);
    return fin && fin < ahora ? fin : null;
  }
  return null;
}

export function calcularAcceso(d: DatosAcceso, ahora: Date = new Date()): Acceso {
  switch (d.estado) {
    case null:
    case undefined:
      return "completo";
    case "trial": {
      const fin = fecha(d.trial_end);
      return !fin || fin >= ahora ? "completo" : "solo_lectura";
    }
    case "active": {
      const fin = fecha(d.current_period_end);
      if (!fin || fin >= ahora) return "completo";
      return masDias(fin, DIAS_GRACIA_PAGO) >= ahora ? "gracia" : "solo_lectura";
    }
    case "past_due": {
      const desde = inicioGracia(d, ahora) as Date;
      return masDias(desde, DIAS_GRACIA_PAGO) >= ahora ? "gracia" : "solo_lectura";
    }
    case "canceled": {
      const fin = fecha(d.current_period_end);
      return fin && fin >= ahora ? "completo" : "solo_lectura";
    }
    default:
      return "solo_lectura";
  }
}

/** Dias (redondeados hacia arriba) que le quedan de gracia; 0 si no esta en gracia. */
export function diasDeGracia(d: DatosAcceso, ahora: Date = new Date()): number {
  const desde = inicioGracia(d, ahora);
  if (!desde) return 0;
  const fin = masDias(desde, DIAS_GRACIA_PAGO);
  return Math.max(0, Math.ceil((fin.getTime() - ahora.getTime()) / MS_POR_DIA));
}

/**
 * Cuando perdio el acceso completo (entro a solo lectura). Es la base de los
 * correos (dias 3, 7 y 25) y del plazo de 30 dias para descargar datos.
 */
export function inicioSoloLectura(d: DatosAcceso, ahora: Date = new Date()): Date | null {
  if (calcularAcceso(d, ahora) !== "solo_lectura") return null;
  switch (d.estado) {
    case "active":
    case "past_due": {
      const desde = inicioGracia(d, ahora);
      return desde ? masDias(desde, DIAS_GRACIA_PAGO) : null;
    }
    case "canceled":
      return fecha(d.current_period_end) ?? fecha(d.updated_at);
    default:
      // trial o expired: la prueba es lo ultimo que tuvo.
      return fecha(d.trial_end) ?? fecha(d.current_period_end);
  }
}

/** Fecha limite para descargar la informacion (y de la oferta de regreso). */
export function limiteConservacion(d: DatosAcceso, ahora: Date = new Date()): Date | null {
  const desde = inicioSoloLectura(d, ahora);
  return desde ? masDias(desde, DIAS_CONSERVACION_DATOS) : null;
}
