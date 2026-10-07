/**
 * Demo privada por visitante (migracion 112).
 *
 * Cada "Probar demo" crea un usuario de visitante (`app_metadata.is_demo`) y
 * su propio negocio sembrado (`crear_negocio_demo`). Nadie ve lo de otro y
 * una entrada nueva ya no borra nada. El negocio se borra al salir
 * (`/api/demo/salir`) o al vencer (`borrar_demos_vencidas`, en cada entrada y
 * en el cron `/api/cron/limpiar-demos`).
 */

/** Cuanto dura una demo antes de borrarse sola. */
export const HORAS_DEMO = 2;

/** Tope de demos vivas a la vez: protege la base (plan Free) de abusos. */
export const MAX_DEMOS_ACTIVAS = 300;

/** Demos vencidas que se borran en cada entrada nueva (limpieza perezosa). */
export const LIMPIEZA_POR_ENTRADA = 20;

/**
 * Correo del usuario de visitante. Nunca recibe nada: se crea confirmado y la
 * entrada es por `token_hash`, sin correo. El dominio es nuestro para que no
 * apunte a un buzon ajeno.
 */
export function correoDemo(id: string): string {
  return `demo-${id}@demo.symvora.com.mx`;
}
