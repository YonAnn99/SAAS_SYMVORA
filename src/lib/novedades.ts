/**
 * Novedades del producto: cómo se entera quien ya usa SYMVORA de un módulo
 * nuevo sin depender de las redes sociales.
 *
 * Una novedad se anuncia por cuatro vías y TODAS salen de esta lista:
 * - la etiqueta «Nuevo» en el menú lateral y en el panel «Más» del celular;
 * - la ventana que sale una sola vez al entrar (`ventana-novedad.tsx`);
 * - el aviso en la campana (una fila `tipo = 'novedad'` por negocio, que se
 *   siembra con una migración; ver la 126);
 * - el correo a los dueños (`/api/cron/anuncio-novedad`, se corre a mano).
 *
 * Solo la ve quien tiene el `permiso` del módulo: al cajero no se le anuncia
 * lo que no puede abrir.
 *
 * Una novedad con `funcion` es un botón DENTRO de un módulo (p. ej. «Etiquetas»
 * en Productos): la etiqueta «Nuevo» va en ese botón y no en el menú, entrar al
 * módulo no la marca vista (se marca al usarla) y no abre la ventana.
 *
 * Lo visto se recuerda en `localStorage` por usuario. Es una cortesía: verla
 * otra vez en otro aparato no hace daño, así que no lleva tabla.
 */

export interface Novedad {
  id: string;
  /** Ruta del panel sin idioma: la etiqueta se pega a esta opción del menú. */
  href: string;
  /** Permiso del módulo; `null` = todo el equipo (como el catálogo de Productos). */
  permiso: string | null;
  /**
   * Función dentro del módulo (el botón que lleva la etiqueta). Sin ella, la
   * novedad es el módulo entero.
   */
  funcion?: string;
  /** Día (CDMX) desde el que se anuncia y día hasta el que dura la etiqueta. */
  desde: string;
  hasta: string;
  titulo: string;
  texto: string;
  puntos: readonly string[];
  boton: string;
}

export const NOVEDADES: readonly Novedad[] = [
  {
    id: "catalogo-en-linea",
    href: "/online-catalog",
    permiso: "catalog.manage",
    desde: "2026-10-30",
    hasta: "2026-11-20",
    titulo: "Nuevo: tu catálogo en línea",
    texto: "Una página con tus productos para compartir por WhatsApp, redes o con un QR en tu mostrador.",
    puntos: [
      "Tus clientes ven tus productos, precios y lo que está agotado.",
      "Arman su pedido y te lo mandan a tu WhatsApp.",
      "Ya viene incluido en tu plan, sin costo extra.",
    ],
    boton: "Conocerlo",
  },
  {
    // Aviso en la campana: migración 134 (negocios actuales y los que se registren
    // hasta `hasta`).
    id: "etiquetas-codigos",
    href: "/products",
    funcion: "etiquetas",
    permiso: null,
    desde: "2026-11-12",
    hasta: "2026-12-03",
    titulo: "Nuevo: etiquetas con código de barras",
    texto: "Imprime etiquetas con código de barras y precio para tus productos.",
    puntos: [
      "En hoja carta o en rollo para impresora de etiquetas.",
      "Genera códigos a los productos que no tienen.",
    ],
    boton: "Probarlo",
  },
];

/** Día de hoy en Ciudad de México, `AAAA-MM-DD` (las fechas de arriba). */
export function hoyMx(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function novedadVigente(n: Novedad, ahora: Date): boolean {
  const hoy = hoyMx(ahora);
  return hoy >= n.desde && hoy <= n.hasta;
}

/** Lo que una persona ya vio o descartó. */
export interface EstadoNovedades {
  /** Abrió el módulo: se quita la etiqueta y la ventana ya no sale. */
  vistas: string[];
  /** Cerró la ventana con «Después»: no vuelve, pero la etiqueta sigue. */
  descartadas: string[];
}

export const ESTADO_VACIO: EstadoNovedades = { vistas: [], descartadas: [] };

/** Las novedades vigentes que esta persona puede abrir. */
export function novedadesPara(ahora: Date, can: (permiso: string) => boolean): Novedad[] {
  return NOVEDADES.filter((n) => novedadVigente(n, ahora) && (n.permiso === null || can(n.permiso)));
}

/** La novedad que lleva la etiqueta «Nuevo» en esta opción del menú, si hay. */
export function esNuevo(href: string, activas: readonly Novedad[], estado: EstadoNovedades): boolean {
  return activas.some((n) => !n.funcion && n.href === href && !estado.vistas.includes(n.id));
}

/** Si el botón `funcion` (dentro de su módulo) lleva la etiqueta «Nuevo». */
export function esFuncionNueva(
  funcion: string,
  activas: readonly Novedad[],
  estado: EstadoNovedades
): boolean {
  return activas.some((n) => n.funcion === funcion && !estado.vistas.includes(n.id));
}

/** La que toca enseñar en la ventana: la primera que no vio ni descartó. */
export function novedadPorMostrar(
  activas: readonly Novedad[],
  estado: EstadoNovedades
): Novedad | null {
  return (
    activas.find(
      (n) => !n.funcion && !estado.vistas.includes(n.id) && !estado.descartadas.includes(n.id)
    ) ?? null
  );
}

/** Lee lo guardado sin confiar en su forma (lo puede haber tocado cualquiera). */
export function leerEstado(texto: string | null): EstadoNovedades {
  if (!texto) return ESTADO_VACIO;
  try {
    const crudo = JSON.parse(texto) as Partial<Record<keyof EstadoNovedades, unknown>>;
    const lista = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return { vistas: lista(crudo.vistas), descartadas: lista(crudo.descartadas) };
  } catch {
    return ESTADO_VACIO;
  }
}

export function claveNovedades(userId: string): string {
  return `symvora-novedades:${userId}`;
}
