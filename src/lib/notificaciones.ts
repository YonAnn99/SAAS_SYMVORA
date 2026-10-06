/**
 * Notificaciones de la campana del header (migración 108).
 *
 * Las genera la base con triggers (stock que empeora y acciones de los
 * colaboradores); la RLS decide quién ve cada una. Aquí solo vive la parte
 * pura que usan la campana y el correo de stock: cómo se pinta cada tipo,
 * cuántas faltan por leer y el texto de "hace cuánto".
 */

export type TipoNotificacion =
  | "stock_bajo"
  | "stock_agotado"
  | "caja_cerrada"
  | "producto"
  | "compra"
  | "orden_compra"
  | "ajuste"
  | "traspaso";

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string | null;
  /** Ruta del panel sin idioma (`/products`). */
  enlace: string | null;
  creado_en: string;
  /** Solo stock: NULL mientras el correo no ha salido. */
  correo_enviado_en: string | null;
}

/** Los avisos que viajan por correo inmediato (el resto solo va a la campana). */
export const TIPOS_STOCK: readonly TipoNotificacion[] = ["stock_bajo", "stock_agotado"];

export function esAvisoDeStock(tipo: string): boolean {
  return (TIPOS_STOCK as readonly string[]).includes(tipo);
}

/**
 * Hay algún aviso de stock RECIENTE cuyo correo aún no sale: hay que pedir el
 * envío. Solo las últimas 24 h, la misma ventana que `reclamar_avisos_stock`:
 * uno más viejo nunca saldrá y pedirlo en cada carga sería una llamada inútil.
 */
export function hayCorreoDeStockPendiente(
  lista: readonly Notificacion[],
  ahora: number = Date.now()
): boolean {
  return lista.some(
    (n) =>
      esAvisoDeStock(n.tipo) &&
      !n.correo_enviado_en &&
      ahora - new Date(n.creado_en).getTime() < 24 * 60 * 60 * 1000
  );
}

/**
 * Cuántas no ha visto. `leidoHasta` NULL = nunca abrió la campana: todas
 * cuentan. Una notificación agrupada ("Ana creó 12 productos") actualiza su
 * `creado_en`, así que vuelve a contar como nueva.
 */
export function contarNoLeidas(lista: readonly Notificacion[], leidoHasta: string | null): number {
  if (!leidoHasta) return lista.length;
  const corte = new Date(leidoHasta).getTime();
  return lista.filter((n) => new Date(n.creado_en).getTime() > corte).length;
}

/** El globo de la campana: "9+" a partir de 10. Vacío sin pendientes. */
export function etiquetaGlobo(noLeidas: number): string {
  if (noLeidas <= 0) return "";
  return noLeidas > 9 ? "9+" : String(noLeidas);
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** "hace un momento", "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const ms = ahora - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < MINUTO) return "hace un momento";
  if (ms < HORA) return `hace ${Math.floor(ms / MINUTO)} min`;
  if (ms < DIA) return `hace ${Math.floor(ms / HORA)} h`;
  const dias = Math.floor(ms / DIA);
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/**
 * Inserta o reemplaza (agrupadas llegan como UPDATE con el mismo id) y deja la
 * lista ordenada de más nueva a más vieja, con un tope.
 */
export function fusionarNotificacion(
  lista: readonly Notificacion[],
  nueva: Notificacion,
  tope = 30
): Notificacion[] {
  return [nueva, ...lista.filter((n) => n.id !== nueva.id)]
    .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
    .slice(0, tope);
}
