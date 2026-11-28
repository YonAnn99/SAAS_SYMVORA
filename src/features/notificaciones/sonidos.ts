/**
 * Sonido de las notificaciones: un tono por tipo (ver `scripts/generar-tonos.mjs`).
 *
 * El interruptor vive en el navegador (`localStorage`), no en la base: es una preferencia de quien
 * está frente a esa pantalla. Si llegan varios avisos juntos, suena UNO: el de mayor prioridad.
 */
import type { TipoNotificacion } from "@/lib/notificaciones";

export type ClaveSonido = "pedido-nuevo" | "stock-agotado" | "stock-bajo" | "novedad" | "atencion";

/** Archivos con versión: el service worker guarda los audios con CacheFirst (ver CLAUDE.md). */
export const RUTA_SONIDO: Record<ClaveSonido, string> = {
  "pedido-nuevo": "/audio/notificaciones/pedido-nuevo.v1.mp3",
  "stock-agotado": "/audio/notificaciones/stock-agotado.v1.mp3",
  "stock-bajo": "/audio/notificaciones/stock-bajo.v1.mp3",
  novedad: "/audio/notificaciones/novedad.v1.mp3",
  atencion: "/audio/notificaciones/atencion.v1.mp3",
};

/**
 * Un `Record` COMPLETO: un tipo nuevo de notificación no compila hasta decidir su sonido.
 * `null` = silencio (sigue apareciendo en la campana).
 */
export const SONIDO_POR_TIPO: Record<TipoNotificacion, ClaveSonido | null> = {
  pedido_nuevo: "pedido-nuevo",
  stock_agotado: "stock-agotado",
  stock_bajo: "stock-bajo",
  novedad: "novedad",
  caja_cerrada: "atencion",
  venta_cancelada: "atencion",
  lote_por_caducar: "atencion",
  lote_caducado: "atencion",
  insumo_faltante: "atencion",
  producto: null,
  compra: null,
  orden_compra: null,
  ajuste: null,
  traspaso: null,
  lote: null,
  lealtad_alta: null,
};

/** De mayor a menor: si llegan varios, gana el primero de esta lista. */
export const PRIORIDAD_SONIDO: readonly ClaveSonido[] = [
  "pedido-nuevo",
  "stock-agotado",
  "stock-bajo",
  "atencion",
  "novedad",
];

/** Entre un tono y el siguiente, como mínimo. */
export const ESPERA_ENTRE_TONOS_MS = 2000;
/** Ventana para juntar avisos que llegan casi a la vez. */
export const VENTANA_AGRUPAR_MS = 300;

const CLAVE = "symvora-sonidos-notificaciones";
/** Clave del interruptor de pedidos antes de este módulo: si quedó en «off», sigue apagado. */
const CLAVE_VIEJA = "symvora-pedido-sonido";

export function sonidoActivo(): boolean {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    if (valor !== null) return valor !== "off";
    return window.localStorage.getItem(CLAVE_VIEJA) !== "off";
  } catch {
    return true;
  }
}

export function cambiarSonido(activo: boolean): void {
  try {
    window.localStorage.setItem(CLAVE, activo ? "on" : "off");
  } catch {
    // Sin almacenamiento: queda encendido.
  }
}

/** El tono que suena entre varios: el de mayor prioridad, o ninguno. */
export function elegirSonido(claves: readonly ClaveSonido[]): ClaveSonido | null {
  for (const clave of PRIORIDAD_SONIDO) {
    if (claves.includes(clave)) return clave;
  }
  return null;
}

let pendientes: ClaveSonido[] = [];
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ultimoTono = 0;

/**
 * Tono que el navegador bloqueó (sin ninguna interacción previa del usuario con la página).
 * Se toca en cuanto haya un toque o una tecla, si el aviso no tiene más de un minuto.
 */
let bloqueado: { clave: ClaveSonido; cuando: number } | null = null;
const VIGENCIA_BLOQUEADO_MS = 60_000;

function reproducir(clave: ClaveSonido): void {
  try {
    const audio = new Audio(RUTA_SONIDO[clave]);
    audio.volume = 0.6;
    audio.play().catch(() => {
      // El navegador exige un gesto del usuario: se guarda para el siguiente toque.
      bloqueado = { clave, cuando: Date.now() };
    });
  } catch {
    // Sin audio: el aviso visual basta.
  }
}

let escuchandoGestos = false;

/**
 * Llamarla una vez desde la app. Los navegadores solo dejan sonar audio tras un toque o una
 * tecla: si un aviso llegó antes, suena en ese primer gesto.
 */
export function prepararSonidoConGesto(): void {
  if (escuchandoGestos || typeof window === "undefined") return;
  escuchandoGestos = true;
  const alGesto = () => {
    const pendiente = bloqueado;
    bloqueado = null;
    if (pendiente && Date.now() - pendiente.cuando < VIGENCIA_BLOQUEADO_MS) reproducir(pendiente.clave);
  };
  window.addEventListener("pointerdown", alGesto, { passive: true });
  window.addEventListener("keydown", alGesto);
}

function vaciar(): void {
  temporizador = null;
  const elegido = elegirSonido(pendientes);
  pendientes = [];
  if (!elegido) return;
  const ahora = Date.now();
  if (ahora - ultimoTono < ESPERA_ENTRE_TONOS_MS) return;
  ultimoTono = ahora;
  reproducir(elegido);
}

/** Llamarla por cada aviso NUEVO que llega en vivo (no al cargar la campana ni en actualizaciones). */
export function tocarSonidoDeTipo(tipo: TipoNotificacion): void {
  const clave = SONIDO_POR_TIPO[tipo];
  if (!clave || !sonidoActivo()) return;
  pendientes.push(clave);
  if (temporizador === null) temporizador = setTimeout(vaciar, VENTANA_AGRUPAR_MS);
}
