/**
 * Logica pura de las tarjetas de lealtad (migracion 115): progreso, lectura
 * del QR, enlace publico y paleta de colores. Sin React ni Supabase: se prueba
 * en `src/__tests__/lealtad.test.ts`.
 *
 * Las reglas que deciden dinero (sellos, canje, premio) viven en el servidor
 * (`complete_sale_lealtad`); aqui solo se presenta y se anticipa lo que el
 * servidor confirmara.
 */
import { getAppUrl } from "@/lib/site";
import type { PaletaTarjeta } from "./types";

/** Mismo alfabeto que `_codigo_tarjeta_lealtad`: sin 0/O, 1/I/L ni U. */
const CODIGO = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

export interface Progreso {
  /** Sellos a pintar llenos en la cuadricula (nunca mas que la meta). */
  llenos: number;
  meta: number;
  /** Cuantos faltan para el premio (0 si ya lo tiene). */
  faltan: number;
  /** Premios completos que puede canjear (un ajuste puede dejar mas de uno). */
  premiosDisponibles: number;
  /** 0 a 100, para la barra. */
  pct: number;
}

export function progreso(sellos: number, meta: number): Progreso {
  const s = Math.max(0, Math.floor(sellos || 0));
  const m = Math.max(1, Math.floor(meta || 1));
  return {
    llenos: Math.min(s, m),
    meta: m,
    faltan: Math.max(0, m - s),
    premiosDisponibles: Math.floor(s / m),
    pct: Math.min(100, Math.round((s / m) * 100)),
  };
}

/** "Llevas 8 de 10 para tu Café grande gratis" / "¡Ya tienes tu Café grande gratis!". */
export function textoProgreso(sellos: number, meta: number, premio: string): string {
  const p = progreso(sellos, meta);
  if (p.premiosDisponibles > 0) return `¡Ya tienes tu ${premio}!`;
  return `Llevas ${p.llenos} de ${p.meta} para tu ${premio}`;
}

/**
 * El codigo de una tarjeta a partir de lo que se escaneo o tecleo: la URL
 * completa del QR (`…/es/tarjeta/6XAHQCNCHPZF`), el codigo solo o el codigo
 * agrupado como se imprime (`6XAH-QCNC-HPZF`). `null` si no es una tarjeta:
 * el POS sigue tratandolo como codigo de producto.
 */
export function codigoDesdeEscaneo(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto.trim();
  const enUrl = limpio.match(/\/tarjeta\/([A-Za-z0-9-]+)/);
  const candidato = (enUrl ? enUrl[1] : limpio).replace(/[\s-]/g, "").toUpperCase();
  return CODIGO.test(candidato) ? candidato : null;
}

/** "6XAH-QCNC-HPZF": mas facil de leer y dictar que 12 letras seguidas. */
export function codigoAgrupado(codigo: string): string {
  return codigo.replace(/(.{4})(?=.)/g, "$1-");
}

/** Enlace publico de la tarjeta (el que lleva el QR). */
export function urlTarjeta(codigo: string, locale = "es", base = getAppUrl()): string {
  return `${base.replace(/\/$/, "")}/${locale === "en" ? "en" : "es"}/tarjeta/${codigo}`;
}

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------

/** Azul SYMVORA, si el negocio no eligio color. */
export const ACENTO_POR_DEFECTO = "#1E3A8A";

export interface ColoresTarjeta {
  fondo: string;
  texto: string;
  textoSuave: string;
  borde: string;
  /** Sello lleno y barra. */
  acento: string;
  /** Texto o icono encima del acento. */
  sobreAcento: string;
  /** Sello vacio y fondo de la barra. */
  vacio: string;
}

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Luminancia relativa (WCAG), 0 = negro, 1 = blanco. */
export function luminancia(hex: string): number {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mezclar(hex: string, con: string, peso: number): string {
  const a = rgb(hex);
  const b = rgb(con);
  if (!a || !b) return hex;
  return aHex([0, 1, 2].map((i) => a[i] * (1 - peso) + b[i] * peso) as [number, number, number]);
}

/**
 * Colores de la tarjeta para cada paleta. El acento es el del negocio, pero se
 * aclara sobre fondo oscuro (o se oscurece sobre claro) cuando casi no se
 * veria: un azul marino sobre negro deja los sellos invisibles.
 */
export function paletaDeTarjeta(paleta: PaletaTarjeta, acento: string | null | undefined): ColoresTarjeta {
  const base = acento && rgb(acento) ? aHex(rgb(acento)!) : ACENTO_POR_DEFECTO;

  if (paleta === "oscura") {
    const visible = luminancia(base) < 0.12 ? mezclar(base, "#FFFFFF", 0.45) : base;
    return {
      fondo: "#0F172A",
      texto: "#F8FAFC",
      textoSuave: "#94A3B8",
      borde: "#1E293B",
      acento: visible,
      sobreAcento: luminancia(visible) > 0.45 ? "#0F172A" : "#FFFFFF",
      vacio: "#1E293B",
    };
  }

  const visible = luminancia(base) > 0.6 ? mezclar(base, "#000000", 0.35) : base;
  return {
    fondo: "#FFFFFF",
    texto: "#0F172A",
    textoSuave: "#64748B",
    borde: "#E2E8F0",
    acento: visible,
    sobreAcento: luminancia(visible) > 0.45 ? "#0F172A" : "#FFFFFF",
    vacio: "#F1F5F9",
  };
}

// ---------------------------------------------------------------------------
// Premio en el carrito del POS
// ---------------------------------------------------------------------------

export interface LineaParaPremio {
  productId: string;
  varianteId?: string | null;
  cantidad: number;
  precioUnitario: number;
  /** Descuento que ya trae el renglon (descuento manual repartido). */
  descuento: number;
}

export interface PremioPrograma {
  tipo: "producto" | "monto" | "porcentaje";
  productoId: string | null;
  varianteId: string | null;
  valor: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * El premio aplicado a los renglones del carrito, para MOSTRAR el total que
 * cobrara el servidor. Es el mismo algoritmo que `complete_sale_lealtad`
 * (migracion 115): si cambia alla, cambia aqui. Al servidor se le mandan los
 * renglones SIN premio y el lo calcula de nuevo con sus precios.
 *
 * - producto: una unidad gratis del primer renglon de ese producto (o lo que
 *   le quede despues del descuento manual). Sin el renglon: `faltaProducto`.
 * - monto / porcentaje: sobre el subtotal menos el descuento manual, llenando
 *   los renglones en orden.
 */
export function aplicarPremio<T extends LineaParaPremio>(
  items: T[],
  premio: PremioPrograma
): { items: T[]; monto: number; faltaProducto: boolean } {
  const lineas = items.map((it) => {
    const linea = r2(it.precioUnitario * it.cantidad);
    return { linea, desc: Math.min(Math.max(r2(it.descuento || 0), 0), linea) };
  });

  if (premio.tipo === "producto") {
    const i = items.findIndex(
      (it) =>
        it.productId === premio.productoId &&
        (premio.varianteId == null || (it.varianteId ?? null) === premio.varianteId)
    );
    if (i < 0) return { items, monto: 0, faltaProducto: true };
    const aplicar = r2(Math.min(items[i].precioUnitario, lineas[i].linea - lineas[i].desc));
    return {
      items: items.map((it, j) => (j === i ? { ...it, descuento: r2(lineas[i].desc + aplicar) } : it)),
      monto: aplicar,
      faltaProducto: false,
    };
  }

  const subtotal = lineas.reduce((s, l) => s + l.linea, 0);
  const manual = lineas.reduce((s, l) => s + l.desc, 0);
  const valor = Number(premio.valor) || 0;
  let total = premio.tipo === "monto" ? valor : r2(((subtotal - manual) * valor) / 100);
  total = Math.max(0, Math.min(total, r2(subtotal - manual)));

  let restante = total;
  const conPremio = items.map((it, j) => {
    if (restante <= 0) return it;
    const aplicar = r2(Math.min(restante, lineas[j].linea - lineas[j].desc));
    if (aplicar <= 0) return it;
    restante = r2(restante - aplicar);
    return { ...it, descuento: r2(lineas[j].desc + aplicar) };
  });
  return { items: conPremio, monto: r2(total - restante), faltaProducto: false };
}
