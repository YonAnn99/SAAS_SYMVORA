"use client";

/**
 * La impresora de tickets de ESTE equipo: cual es, el ancho del papel y si
 * imprime sola al cobrar. Se guarda en `localStorage` (la impresora es del
 * equipo, no del negocio: la caja 1 tiene la suya y el celular del repartidor
 * la suya).
 *
 * La conexion vive en memoria del modulo, compartida por el POS, el ticket y
 * Reportes. Al recargar se reabre sola si el navegador lo permite
 * (`reconectarImpresora`); si no, el primer "Imprimir" la vuelve a pedir.
 */

import { useSyncExternalStore } from "react";
import {
  conexionesDisponibles,
  elegirImpresora,
  reconectarImpresora,
  type Conexion,
  type TipoConexion,
} from "./conexiones";
import type { AnchoPapel } from "./escpos";

export interface ConfigImpresora {
  tipo: TipoConexion;
  nombre: string | null;
  ancho: AnchoPapel;
  /** Imprimir sola al completar una venta. */
  auto: boolean;
  baudios: number;
}

export type EstadoConexion = "sin-configurar" | "desconectada" | "conectando" | "lista" | "error";

export interface EstadoImpresora {
  config: ConfigImpresora | null;
  estado: EstadoConexion;
  mensaje: string | null;
  soportadas: TipoConexion[];
}

const CLAVE = "symvora_impresora_tickets";

let conexion: Conexion | null = null;
let intentoInicial = false;
const oyentes = new Set<() => void>();

function leerConfig(): ConfigImpresora | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as ConfigImpresora) : null;
  } catch {
    return null;
  }
}

function guardarConfig(config: ConfigImpresora | null) {
  try {
    if (config) window.localStorage.setItem(CLAVE, JSON.stringify(config));
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento (modo privado): vale para esta sesion.
  }
}

const SIN_VENTANA: EstadoImpresora = {
  config: null,
  estado: "sin-configurar",
  mensaje: null,
  soportadas: [],
};

let actual: EstadoImpresora = SIN_VENTANA;
let inicializado = false;

function publicar(parcial: Partial<EstadoImpresora>) {
  actual = { ...actual, ...parcial };
  oyentes.forEach((avisar) => avisar());
}

function inicializar() {
  if (inicializado || typeof window === "undefined") return;
  inicializado = true;
  const config = leerConfig();
  actual = {
    config,
    estado: config ? "desconectada" : "sin-configurar",
    mensaje: null,
    soportadas: conexionesDisponibles(),
  };
}

/** Reabre en segundo plano la impresora guardada, una vez por carga. */
function intentarReconexionInicial() {
  if (intentoInicial || !actual.config) return;
  intentoInicial = true;
  const { tipo, nombre, baudios } = actual.config;
  publicar({ estado: "conectando" });
  void reconectarImpresora(tipo, nombre, baudios).then((c) => {
    conexion = c;
    publicar({ estado: c ? "lista" : "desconectada", mensaje: null });
  });
}

function suscribir(avisar: () => void) {
  inicializar();
  oyentes.add(avisar);
  intentarReconexionInicial();
  return () => oyentes.delete(avisar);
}

export function useImpresora(): EstadoImpresora {
  return useSyncExternalStore(
    suscribir,
    () => {
      inicializar();
      return actual;
    },
    () => SIN_VENTANA
  );
}

/** Elige y conecta una impresora (necesita el toque del usuario). */
export async function conectarImpresora(tipo: TipoConexion): Promise<void> {
  inicializar();
  publicar({ estado: "conectando", mensaje: null });
  try {
    await conexion?.cerrar().catch(() => {});
    const baudios = actual.config?.baudios ?? 9600;
    conexion = await elegirImpresora(tipo, baudios);
    const config: ConfigImpresora = {
      tipo,
      nombre: conexion.nombre,
      ancho: actual.config?.ancho ?? 58,
      auto: actual.config?.auto ?? true,
      baudios,
    };
    guardarConfig(config);
    publicar({ config, estado: "lista", mensaje: null });
  } catch (e) {
    conexion = null;
    // Cerrar el selector sin elegir no es un error que haya que mostrar.
    const cancelado = e instanceof Error && /cancel|chosen|No port selected|No device selected/i.test(e.message);
    publicar({
      estado: actual.config ? "desconectada" : "sin-configurar",
      mensaje: cancelado ? null : e instanceof Error ? e.message : "No se pudo conectar",
    });
    if (!cancelado) throw e;
  }
}

export function ajustarImpresora(cambios: Partial<Pick<ConfigImpresora, "ancho" | "auto" | "baudios">>) {
  inicializar();
  if (!actual.config) return;
  const config = { ...actual.config, ...cambios };
  guardarConfig(config);
  publicar({ config });
}

export async function olvidarImpresora() {
  await conexion?.cerrar().catch(() => {});
  conexion = null;
  guardarConfig(null);
  publicar({ config: null, estado: "sin-configurar", mensaje: null });
}

/**
 * Manda bytes a la impresora. Si no hay conexion, la reabre (sin preguntar si
 * se puede; si no, pidiendola, lo que requiere venir de un toque). Lanza si no
 * se pudo, para que quien llama ofrezca la ventana de impresion de respaldo.
 */
export async function imprimirBytes(datos: Uint8Array): Promise<void> {
  inicializar();
  const config = actual.config;
  if (!config) throw new Error("No hay impresora configurada");

  try {
    if (!conexion) {
      publicar({ estado: "conectando" });
      conexion =
        (await reconectarImpresora(config.tipo, config.nombre, config.baudios)) ??
        (await elegirImpresora(config.tipo, config.baudios));
    }
    await conexion.escribir(datos);
    publicar({ estado: "lista", mensaje: null });
  } catch (e) {
    // Apagada, fuera de alcance, desconectada: la proxima vez se reabre.
    await conexion?.cerrar().catch(() => {});
    conexion = null;
    publicar({
      estado: "error",
      mensaje: e instanceof Error ? e.message : "No se pudo imprimir",
    });
    throw e;
  }
}
