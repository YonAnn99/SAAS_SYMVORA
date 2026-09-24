/**
 * Empujon de "abre tu caja" del primer acceso del dia.
 *
 * Es un EMPUJON, no un candado: lleva una vez a Finanzas y desde ahi el usuario
 * puede irse a donde quiera. Lo unico realmente cerrado sin caja es el POS.
 */

const PREFIJO = "symvora_caja_aviso";

/**
 * Clave del aviso, con el id de usuario DENTRO.
 *
 * No es un detalle: en un mostrador compartido dos cajeros usan el mismo
 * navegador. Con una clave global, el segundo del turno no recibiria el aviso
 * porque el primero ya lo habria consumido — y es justo quien mas lo necesita,
 * porque llega con la caja del anterior ya cerrada.
 */
export function claveAviso(userId: string, hoy: Date = new Date()): string {
  return `${PREFIJO}:${userId}:${fechaLocal(hoy)}`;
}

/**
 * Fecha en horario LOCAL, no UTC.
 *
 * `toISOString()` daria UTC y en Mexico (UTC-6) el dia cambiaria a las 18:00
 * hora local: un cajero del turno de noche recibiria el aviso a media jornada.
 */
function fechaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Si a este usuario ya se le avisó hoy. */
export function yaAvisadoHoy(userId: string, hoy: Date = new Date()): boolean {
  try {
    return window.localStorage.getItem(claveAviso(userId, hoy)) !== null;
  } catch {
    // Modo privado o almacenamiento bloqueado: se prefiere NO avisar a entrar
    // en un bucle de redirecciones en cada carga.
    return true;
  }
}

/** Deja constancia de que ya se avisó, y limpia los días anteriores. */
export function marcarAvisado(userId: string, hoy: Date = new Date()): void {
  try {
    const clave = claveAviso(userId, hoy);
    // Sin esta limpieza, localStorage acumularia una entrada por usuario y dia
    // para siempre en las terminales que nunca se vacian.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(`${PREFIJO}:`) && k !== clave) {
        window.localStorage.removeItem(k);
      }
    }
    window.localStorage.setItem(clave, "1");
  } catch {
    // Si no se puede escribir, el aviso saldra otra vez. Molesto, no roto.
  }
}

/**
 * Si toca llevar al usuario a Finanzas a abrir caja. Reune las condiciones que
 * estaban sueltas en `OpenRegisterPrompt`, mas la del tutorial:
 *
 * - Solo si SABEMOS que no hay caja (`false`). `null` es "no se pudo
 *   resolver": ante la duda no se estorba por un fallo de red.
 * - Ya en Finanzas sobra, y redirigir ahi seria un bucle.
 * - CON EL TUTORIAL EN CURSO, NO. En el primer acceso se abrian a la vez el
 *   tutorial, el empujon a Finanzas y el dialogo de abrir caja. El tutorial ya
 *   tiene su paso "Abre la caja" (despues de configurar, proveedores y
 *   productos): mientras corre, el guia.
 */
export function debeEmpujarAFinanzas(estado: {
  hayCaja: boolean | null;
  ruta: string;
  tutorialEnCurso: boolean;
}): boolean {
  if (estado.hayCaja !== false) return false;
  if (estado.tutorialEnCurso) return false;
  const limpia = estado.ruta.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
  return !limpia.startsWith("/finances");
}
