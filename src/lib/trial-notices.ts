/**
 * Decide a quien le toca un aviso de fin de prueba.
 *
 * Se separa de la ruta de cron a proposito: es la unica parte con reglas de
 * negocio y la unica que merece test. La ruta solo consulta, itera y manda.
 *
 * DOS AVISOS, no mas: uno cuando faltan <=2 dias y otro cuando ya vencio. En
 * una prueba de 7 dias, mas correos se leen como insistencia.
 */

/** Dias antes del vencimiento en que sale el aviso previo. */
export const DIAS_AVISO_PREVIO = 2;

/**
 * Ventana de gracia para el aviso de "ya vencio".
 *
 * POR QUE EXISTE: sin esta cota, la primera ejecucion del cron mandaria el
 * correo de vencimiento a CUALQUIER prueba caducada del historico — cuentas
 * abandonadas hace meses incluidas. Una prueba que vencio hace mas de estos
 * dias ya no recibe nada: el aviso habria perdido todo sentido y solo seria
 * spam.
 */
export const DIAS_GRACIA_AVISO_FIN = 3;

const MS_POR_DIA = 86_400_000;

export type TipoAviso = "por_vencer" | "vencida";

/** Lo minimo que hace falta para decidir. */
export interface SuscripcionParaAviso {
  status: string;
  trial_end: string | Date;
  /** Cuando se mando el aviso previo, o null si no se ha mandado. */
  trial_aviso_previo_en: string | Date | null;
  /** Cuando se mando el aviso de vencimiento, o null. */
  trial_aviso_fin_en: string | Date | null;
}

/** Dias completos que faltan (negativo si ya vencio). */
export function diasRestantes(
  trialEnd: string | Date,
  ahora: Date = new Date()
): number {
  const fin = trialEnd instanceof Date ? trialEnd : new Date(trialEnd);
  const dias = Math.ceil((fin.getTime() - ahora.getTime()) / MS_POR_DIA);
  // `Math.ceil` de una fraccion negativa devuelve -0. No cambia ninguna
  // comparacion, pero `Object.is(-0, 0)` es false y eso sorprende a quien
  // compare el resultado; se normaliza aqui y no en cada llamada.
  return dias === 0 ? 0 : dias;
}

/**
 * Que aviso le corresponde, o `null` si ninguno.
 *
 * La idempotencia se apoya en las dos marcas de tiempo: el cron corre a diario
 * y sin ellas repetiria el mismo correo cada dia hasta que el usuario pagara.
 */
export function avisoPendiente(
  sub: SuscripcionParaAviso,
  ahora: Date = new Date()
): TipoAviso | null {
  // Solo pruebas vivas. Una cuenta `active` ya paga y una `canceled` se dio de
  // baja a proposito: a ninguna de las dos se le avisa de nada.
  if (sub.status !== "trial") return null;

  const dias = diasRestantes(sub.trial_end, ahora);

  if (dias > 0) {
    if (dias > DIAS_AVISO_PREVIO) return null;
    return sub.trial_aviso_previo_en ? null : "por_vencer";
  }

  // Ya vencio. `dias <= 0`.
  if (dias < -DIAS_GRACIA_AVISO_FIN) return null;
  return sub.trial_aviso_fin_en ? null : "vencida";
}

/** Columna que hay que marcar tras enviar, para no repetir el correo. */
export function columnaMarca(tipo: TipoAviso): string {
  return tipo === "por_vencer"
    ? "trial_aviso_previo_en"
    : "trial_aviso_fin_en";
}
