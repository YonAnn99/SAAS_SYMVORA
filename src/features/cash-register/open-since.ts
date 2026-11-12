/**
 * Textos de "cuando se abrio la caja" para la previsualizacion de Finanzas.
 *
 * Vive aparte del componente porque es lo unico con logica: redondeos, plurales
 * y el caso de la fecha invalida. El JSX solo pinta lo que sale de aqui.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Fecha y hora de apertura en el formato del idioma (Mexico por defecto). */
export function formatearApertura(
  fecha: string | Date | null | undefined,
  locale = "es-MX",
  sinFecha = "Fecha no disponible"
): string {
  const d = aFecha(fecha);
  if (!d) return sinFecha;

  return d.toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Cuanto lleva abierta, en lenguaje natural.
 *
 * Es el dato mas accionable de "cuando se abrio": dice de un vistazo si el
 * turno lleva demasiado tiempo sin cortar.
 */
export function tiempoAbierta(
  fecha: string | Date | null | undefined,
  ahora: Date = new Date()
): string {
  const d = duracionAbierta(fecha, ahora);
  if (!d) return "";
  switch (d.tipo) {
    case "momento":
      return "Abierta hace un momento";
    case "minutos":
      return `Abierta hace ${d.n} ${plural(d.n, "minuto", "minutos")}`;
    case "horas": {
      const base = `Abierta hace ${d.n} ${plural(d.n, "hora", "horas")}`;
      return d.min > 0 ? `${base} ${d.min} min` : base;
    }
    case "dias":
      return `Abierta hace ${d.n} ${plural(d.n, "día", "días")}`;
  }
}

/** Lo que lleva abierta, sin texto: la interfaz lo traduce (`tiempoAbierta` es el español). */
export type DuracionAbierta =
  | { tipo: "momento" }
  | { tipo: "minutos"; n: number }
  | { tipo: "horas"; n: number; min: number }
  | { tipo: "dias"; n: number };

export function duracionAbierta(
  fecha: string | Date | null | undefined,
  ahora: Date = new Date()
): DuracionAbierta | null {
  const d = aFecha(fecha);
  if (!d) return null;

  const ms = ahora.getTime() - d.getTime();

  // Una caja recien abierta: "hace 0 min" se lee como un error. Tambien un
  // reloj adelantado o fecha futura: no se inventa un "hace -3 min".
  if (ms < MINUTO) return { tipo: "momento" };

  if (ms < HORA) return { tipo: "minutos", n: Math.floor(ms / MINUTO) };

  if (ms < DIA) {
    return { tipo: "horas", n: Math.floor(ms / HORA), min: Math.floor((ms % HORA) / MINUTO) };
  }

  return { tipo: "dias", n: Math.floor(ms / DIA) };
}

function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}

function aFecha(fecha: string | Date | null | undefined): Date | null {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  // `new Date("cualquier cosa")` no lanza, devuelve Invalid Date. Sin esta
  // comprobacion, el tooltip mostraria "Invalid Date" al usuario.
  return Number.isNaN(d.getTime()) ? null : d;
}
