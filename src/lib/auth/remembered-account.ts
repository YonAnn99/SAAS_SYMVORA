/**
 * "Recordarme": guarda el correo de la ultima cuenta que inicio sesion en este
 * dispositivo para no tener que teclearlo cada vez.
 *
 * Se guarda SOLO el correo. Nunca la contrasena, ni la clave de invitacion, ni
 * ningun token: la sesion la maneja Supabase en sus propias cookies y esto no
 * la toca. Por eso desmarcar el switch no cierra la sesion abierta, solo deja
 * de rellenar el correo la proxima vez.
 *
 * Antes el switch existia en la pantalla pero su estado no se leia en ningun
 * sitio: marcarlo o desmarcarlo no cambiaba absolutamente nada.
 *
 * DOS AMBITOS, NO UNO. Hay dos formas de entrar al sistema y en el mostrador
 * conviven: el dueno con correo y contrasena, y el cajero con su clave de
 * invitacion. Con una sola clave de almacenamiento compartida pasaban dos cosas
 * malas:
 *
 *   - el correo del cajero acababa prerrellenado en el formulario del dueno,
 *     que es donde no le sirve de nada;
 *   - y el cajero apagando su switch BORRABA el correo recordado del dueno,
 *     porque apagarlo llama a `forgetRememberedEmail()`.
 *
 * Cada formulario tiene su hueco. Los dos guardan solo un correo.
 */

export type AmbitoRecordado = "password" | "clave";

/**
 * `password` conserva la clave original a proposito: cambiarla haria que todo
 * el mundo perdiera su correo recordado al desplegar, sin ganar nada.
 */
const CLAVES: Record<AmbitoRecordado, string> = {
  password: "symvora_remembered_email",
  clave: "symvora_remembered_key_email",
};

/** Todas las claves que este modulo puede escribir. Lo usa su test. */
export const CLAVES_RECORDADAS = Object.values(CLAVES);

/** Correo recordado de ese formulario, o `null` si no hay o no se puede leer. */
export function loadRememberedEmail(
  ambito: AmbitoRecordado = "password"
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CLAVES[ambito]);
    // Se valida que parezca un correo: si alguien metiera otra cosa bajo esa
    // clave, no se prerrellena en un campo de inicio de sesion.
    return value && value.includes("@") ? value : null;
  } catch {
    // Modo privado o almacenamiento bloqueado: se comporta como si no hubiera.
    return null;
  }
}

export function rememberEmail(
  email: string,
  ambito: AmbitoRecordado = "password"
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVES[ambito], email.trim());
  } catch {
    // No es critico: solo significa teclear el correo la proxima vez.
  }
}

export function forgetRememberedEmail(
  ambito: AmbitoRecordado = "password"
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVES[ambito]);
  } catch {
    // Igual que arriba.
  }
}

/**
 * Aplica la eleccion del switch tras un inicio de sesion correcto.
 *
 * Desmarcarlo tiene que BORRAR lo que hubiera guardado antes; si solo dejara de
 * guardar, el correo viejo seguiria apareciendo y el switch pareceria roto otra
 * vez, que es justo el problema que se esta arreglando.
 *
 * Borra SOLO el ambito que se le pasa: apagar el switch del acceso con clave no
 * puede llevarse por delante el correo del dueno.
 */
export function applyRememberChoice(
  email: string,
  remember: boolean,
  ambito: AmbitoRecordado = "password"
): void {
  if (remember) rememberEmail(email, ambito);
  else forgetRememberedEmail(ambito);
}
