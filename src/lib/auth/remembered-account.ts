/**
 * "Recordarme": guarda el correo de la ultima cuenta que inicio sesion en este
 * dispositivo para no tener que teclearlo cada vez.
 *
 * Se guarda SOLO el correo. Nunca la contrasena ni ningun token: la sesion la
 * maneja Supabase en sus propias cookies y esto no la toca. Por eso desmarcar
 * el switch no cierra la sesion abierta, solo deja de rellenar el correo la
 * proxima vez.
 *
 * Antes el switch existia en la pantalla pero su estado no se leia en ningun
 * sitio: marcarlo o desmarcarlo no cambiaba absolutamente nada.
 */

const STORAGE_KEY = "symvora_remembered_email";

/** Correo recordado, o `null` si no hay ninguno o no se puede leer. */
export function loadRememberedEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && value.includes("@") ? value : null;
  } catch {
    // Modo privado o almacenamiento bloqueado: se comporta como si no hubiera.
    return null;
  }
}

export function rememberEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, email.trim());
  } catch {
    // No es critico: solo significa teclear el correo la proxima vez.
  }
}

export function forgetRememberedEmail(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
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
 */
export function applyRememberChoice(email: string, remember: boolean): void {
  if (remember) rememberEmail(email);
  else forgetRememberedEmail();
}
