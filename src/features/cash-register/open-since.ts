/**
 * Textos de "cuando se abrio la caja" para la previsualizacion de Finanzas.
 *
 * Vive aparte del componente porque es lo unico con logica: redondeos, plurales
 * y el caso de la fecha invalida. El JSX solo pinta lo que sale de aqui.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Fecha y hora de apertura en formato local de Mexico. */
export function formatearApertura(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  if (!d) return "Fecha no disponible";

  return d.toLocaleString("es-MX", {
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
  const d = aFecha(fecha);
  if (!d) return "";

  const ms = ahora.getTime() - d.getTime();

  // Una caja recien abierta: "hace 0 min" se lee como un error.
  if (ms < MINUTO) return "Abierta hace un momento";

  // Reloj adelantado o fecha futura: no se inventa un "hace -3 min".
  if (ms < 0) return "Abierta hace un momento";

  if (ms < HORA) {
    const min = Math.floor(ms / MINUTO);
    return `Abierta hace ${min} ${plural(min, "minuto", "minutos")}`;
  }

  if (ms < DIA) {
    const horas = Math.floor(ms / HORA);
    const min = Math.floor((ms % HORA) / MINUTO);
    const base = `Abierta hace ${horas} ${plural(horas, "hora", "horas")}`;
    return min > 0 ? `${base} ${min} min` : base;
  }

  const dias = Math.floor(ms / DIA);
  return `Abierta hace ${dias} ${plural(dias, "día", "días")}`;
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
