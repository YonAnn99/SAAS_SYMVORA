/**
 * Caché de datos entre módulos, en la memoria de la pestaña (plan de
 * rendimiento, fase 2; ver docs/plan-rendimiento-escalabilidad.md).
 *
 * Patrón *stale-while-revalidate*: al volver a un módulo ya visitado se pinta
 * AL INSTANTE lo último que se cargó y, en paralelo, el hook vuelve a pedir
 * todo a Supabase como siempre. Nunca reemplaza la consulta: solo evita la
 * pantalla vacía mientras llega.
 *
 * Reglas:
 * - Solo vive en el navegador y en memoria: se pierde al recargar la página o
 *   cerrar la pestaña. No hay `localStorage` (datos del negocio en disco) ni
 *   nada del lado del servidor.
 * - Todo va ligado a un ALCANCE (usuario + negocio). Si cambia el usuario o el
 *   negocio se vacía entera, y al cerrar sesión también (`vaciarCache`). Así
 *   nadie ve datos del usuario anterior en el mismo navegador.
 * - Lo que decide si se puede vender o cobrar (caja abierta, acceso,
 *   permisos) NO se guarda aquí: siempre se consulta fresco.
 * - Sin alcance (contexto aún cargando) no se lee ni se escribe nada.
 */

const memoria = new Map<string, unknown>();
let alcance = "";

/** Lo fija el contexto del tenant al resolver usuario y negocio. */
export function fijarAlcanceCache(userId: string, tenantId: string): void {
  const nuevo = userId && tenantId ? `${userId}:${tenantId}` : "";
  if (nuevo !== alcance) {
    memoria.clear();
    alcance = nuevo;
  }
}

/** Al cerrar sesión: no debe quedar nada del usuario anterior. */
export function vaciarCache(): void {
  memoria.clear();
  alcance = "";
}

function claveDe(partes: readonly unknown[]): string | null {
  return alcance ? `${alcance}|${JSON.stringify(partes)}` : null;
}

/** Lo último guardado con esa clave, o `undefined`. */
export function leerCache<T>(partes: readonly unknown[]): T | undefined {
  const clave = claveDe(partes);
  return clave ? (memoria.get(clave) as T | undefined) : undefined;
}

/** Guarda lo recién traído del servidor. */
export function guardarCache<T>(partes: readonly unknown[], valor: T): void {
  const clave = claveDe(partes);
  if (clave) memoria.set(clave, valor);
}
