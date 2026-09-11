"use client";

/**
 * Qué se puede hacer sin conexión, y cuánta urgencia tiene reconectarse.
 *
 * Fuente única para los avisos: el diálogo de bienvenida de la PWA, el banner
 * de ventas pendientes y cualquier cartel futuro leen de aquí, para que no se
 * contradigan entre sí cuando cambie el alcance del modo offline.
 */

export interface OfflineCapability {
  label: string;
  /** Por qué NO funciona. Solo para las no disponibles. */
  reason?: string;
}

/** Lo que sí funciona sin internet. */
export const OFFLINE_AVAILABLE: OfflineCapability[] = [
  { label: "Cobrar en efectivo" },
  { label: "Cobrar con tarjeta manual" },
  { label: "Buscar productos del catálogo guardado" },
  { label: "Escanear códigos de barras" },
  { label: "Imprimir el ticket de la venta" },
];

/** Lo que NO funciona, con el motivo. El motivo importa: sin él parece arbitrario. */
export const OFFLINE_UNAVAILABLE: OfflineCapability[] = [
  {
    label: "Cobrar con terminal",
    reason: "la terminal necesita conexión para autorizar el cobro",
  },
  {
    label: "Vender a crédito",
    reason: "hay que verificar el saldo del cliente en el servidor",
  },
  {
    label: "Cobrar por transferencia",
    reason: "no se puede confirmar que el dinero llegó",
  },
  {
    label: "Cerrar la caja",
    reason: "el corte no cuadra si hay ventas sin subir",
  },
  {
    label: "Inventario, compras, clientes y reportes",
    reason: "solo el punto de venta funciona sin conexión",
  },
];

export type OfflineUrgency = "ok" | "atencion" | "urgente" | "critico";

export interface OfflineRisk {
  urgency: OfflineUrgency;
  hoursOffline: number;
  title: string;
  message: string;
}

/**
 * Calcula la urgencia a partir de la venta pendiente MÁS ANTIGUA.
 *
 * Los cortes no son arbitrarios: en iOS, Safari puede desalojar el
 * almacenamiento local hacia los **7 días** sin uso del sitio. Como en la cola
 * hay dinero ya cobrado, el aviso sube de tono mucho antes de acercarse a ese
 * límite, para que nadie llegue ahí por descuido.
 */
export function evaluateOfflineRisk(
  oldestPendingIso: string | null,
  now: Date = new Date()
): OfflineRisk {
  if (!oldestPendingIso) {
    return { urgency: "ok", hoursOffline: 0, title: "", message: "" };
  }

  const hours = Math.max(
    0,
    (now.getTime() - new Date(oldestPendingIso).getTime()) / 36e5
  );

  if (hours >= 72) {
    return {
      urgency: "critico",
      hoursOffline: hours,
      title: "Conéctate cuanto antes",
      message:
        "Tienes ventas sin subir desde hace más de 3 días. El teléfono puede borrar estos datos por su cuenta y esas ventas se perderían. Conéctate a internet hoy mismo.",
    };
  }

  if (hours >= 24) {
    return {
      urgency: "urgente",
      hoursOffline: hours,
      title: "Llevas más de un día sin sincronizar",
      message:
        "Las ventas siguen guardadas en este dispositivo, pero no están respaldadas en ningún lado. Conéctate a internet en cuanto puedas.",
    };
  }

  if (hours >= 6) {
    return {
      urgency: "atencion",
      hoursOffline: hours,
      title: "Conviene sincronizar pronto",
      message:
        "Hay ventas esperando desde hace varias horas. En cuanto tengas WiFi o datos se subirán solas.",
    };
  }

  return {
    urgency: "ok",
    hoursOffline: hours,
    title: "",
    message:
      "Las ventas se subirán solas cuando vuelva la conexión.",
  };
}

/** Texto corto de cuánto lleva esperando la venta más antigua. */
export function formatOfflineAge(hours: number): string {
  if (hours < 1) return "menos de una hora";
  if (hours < 24) {
    const h = Math.floor(hours);
    return `${h} ${h === 1 ? "hora" : "horas"}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "día" : "días"}`;
}
