/**
 * Quien es el cajero y en que negocio esta, cuando no hay red para preguntarlo.
 *
 * El problema que resuelve: `TenantProvider` resolvia la identidad SOLO con
 * `supabase.auth.getUser()`, que es una llamada de red. Sin conexion devolvia
 * `user: null` y el contexto caia a `tenantId: ""`. A partir de ahi el Punto de
 * Venta quedaba inservible aunque su pagina estuviera en cache:
 *
 *   - la cache del catalogo se indexa por `pos-catalog-cache:${tenantId}`, asi
 *     que con la cadena vacia era inalcanzable;
 *   - `userId` salia del mismo sitio, asi que las ventas se encolaban con
 *     `userId: ""` y reventaban al sincronizar.
 *
 * SEGURIDAD: la instantanea se borra al cerrar sesion y cuando el servidor dice
 * que la sesion ya no vale. Solo se restaura ante un fallo de RED. La
 * diferencia importa en un mostrador compartido: heredar el negocio del cajero
 * anterior seria peor que no funcionar.
 */

import type { UserRole } from "@/lib/types/database";

const CLAVE = "symvora_offline_session";

export interface SesionOffline {
  tenantId: string;
  userId: string;
  tenantName: string;
  tenantLogo: string | null;
  tenantAddress: string | null;
  role: UserRole | null;
  /** ISO. Sirve para avisar de que los datos pueden estar viejos. */
  guardadaEn: string;
}

export function guardarSesionOffline(
  datos: Omit<SesionOffline, "guardadaEn">
): void {
  // Sin tenant o sin usuario no hay nada util que guardar, y escribir una
  // instantanea a medias seria peor: se restauraria un estado invalido.
  if (!datos.tenantId || !datos.userId) return;
  try {
    window.localStorage.setItem(
      CLAVE,
      JSON.stringify({ ...datos, guardadaEn: new Date().toISOString() })
    );
  } catch {
    // Modo privado o almacenamiento lleno. No es critico: solo significa que
    // este dispositivo no podra abrir el POS sin red.
  }
}

export function leerSesionOffline(): SesionOffline | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as SesionOffline;
    // Se valida lo minimo: un JSON de otra version sin estos campos dejaria el
    // contexto en el mismo estado roto que se queria evitar.
    if (!datos?.tenantId || !datos?.userId) return null;
    return datos;
  } catch {
    return null;
  }
}

export function borrarSesionOffline(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Nunca debe impedir cerrar sesion.
  }
}

/**
 * ¿El fallo al resolver la sesion fue por falta de red, o porque la sesion ya
 * no vale?
 *
 * Solo el primer caso justifica restaurar la instantanea. supabase-js devuelve
 * errores de red sin `status` (o como `AuthRetryableFetchError`); un 401 o 403
 * si lo traen, y significan que hay que borrar lo guardado.
 */
export function esFalloDeRed(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!error || typeof error !== "object") return false;

  const e = error as { name?: string; status?: number };
  if (e.name === "AuthRetryableFetchError") return true;
  // Un error sin codigo de estado no llego a hablar con el servidor.
  if (typeof e.status === "number") return false;
  return true;
}
