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
import type { IconoSello, PaletaTarjeta } from "./types";

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
// Registro con el QR del local (migracion 121)
// ---------------------------------------------------------------------------

/** Mismo alfabeto que las tarjetas, 10 caracteres (CHECK de la 121). */
const CODIGO_ALTA = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

/** El codigo del cartel normalizado, o `null` si no puede ser uno. */
export function codigoAltaValido(texto: string | null | undefined): string | null {
  const c = (texto ?? "").trim().toUpperCase();
  return CODIGO_ALTA.test(c) ? c : null;
}

/** Enlace que lleva el QR del cartel. */
export function urlAlta(codigoAlta: string, locale = "es", base = getAppUrl()): string {
  return `${base.replace(/\/$/, "")}/${locale === "en" ? "en" : "es"}/tarjeta/unirse/${codigoAlta}`;
}

/** Frase del premio en el cartel: "Junta 10 sellos y llévate: Café grande gratis". */
export function textoPremioCartel(meta: number, premio: string): string {
  const m = progreso(0, meta).meta;
  return `Junta ${m} ${m === 1 ? "sello" : "sellos"} y llévate: ${premio.trim()}`;
}

/** Espacios repetidos fuera, como lo guarda `alta_publica_lealtad`. */
export function limpiarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim();
}

/** Misma regla que `alta_publica_lealtad`: 2 a 60 caracteres, sin enlaces ni correos. */
export function nombreAltaValido(nombre: string): boolean {
  const n = limpiarNombre(nombre);
  return n.length >= 2 && n.length <= 60 && !/(https?:|www\.|[<>/@])/i.test(n);
}

/** Ultimos 10 digitos: asi compara la base un celular con los que ya tiene el negocio. */
export function ultimos10(telefono: string | null | undefined): string {
  return (telefono ?? "").replace(/\D/g, "").slice(-10);
}

/** Tarjetas sacadas desde este celular con un cartel (localStorage `symvora-mis-tarjetas`). */
export interface MiTarjeta {
  codigoAlta: string;
  codigo: string;
}

/** Lee la lista guardada; cualquier cosa rara se ignora. */
export function leerMisTarjetas(crudo: string | null): MiTarjeta[] {
  if (!crudo) return [];
  try {
    const lista = JSON.parse(crudo) as unknown;
    if (!Array.isArray(lista)) return [];
    return lista.filter(
      (t): t is MiTarjeta =>
        typeof t?.codigoAlta === "string" && typeof t?.codigo === "string" && codigoDesdeEscaneo(t.codigo) !== null
    );
  } catch {
    return [];
  }
}

/** Agrega (o reemplaza) la tarjeta de ese cartel; guarda a lo mucho 20. */
export function agregarMiTarjeta(lista: MiTarjeta[], nueva: MiTarjeta): MiTarjeta[] {
  return [nueva, ...lista.filter((t) => t.codigoAlta !== nueva.codigoAlta)].slice(0, 20);
}

// ---------------------------------------------------------------------------
// Icono del sello (migracion 120)
// ---------------------------------------------------------------------------

/** Iconos del sello, en el orden del selector. Misma lista que el CHECK de la 120. */
export const ICONOS_SELLO: { valor: IconoSello; texto: string }[] = [
  { valor: "check", texto: "Palomita" },
  { valor: "estrella", texto: "Estrella" },
  { valor: "corazon", texto: "Corazón" },
  { valor: "cafe", texto: "Café" },
  { valor: "pan", texto: "Pan" },
  { valor: "pizza", texto: "Pizza" },
  { valor: "helado", texto: "Helado" },
  { valor: "cerveza", texto: "Cerveza" },
  { valor: "huella", texto: "Huella" },
  { valor: "hueso", texto: "Hueso" },
  { valor: "tijeras", texto: "Tijeras" },
  { valor: "flor", texto: "Flor" },
  { valor: "pesa", texto: "Pesa" },
  { valor: "bolsa", texto: "Bolsa" },
];

/** El icono guardado, o la palomita si no hay (respuesta vieja) o no se reconoce. */
export function iconoDeSello(valor: string | null | undefined): IconoSello {
  return ICONOS_SELLO.some((i) => i.valor === valor) ? (valor as IconoSello) : "check";
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
  /** El fondo es oscuro: la pagina publica pinta su alrededor oscuro tambien. */
  oscuro: boolean;
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

/** Contraste WCAG entre dos colores: 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Colores de la tarjeta para cada paleta. El acento es el del negocio, pero se
 * aclara sobre fondo oscuro (o se oscurece sobre claro) cuando casi no se
 * veria: un azul marino sobre negro deja los sellos invisibles.
 *
 * Con `fondo` (color libre, migracion 120) la paleta deja de importar: el
 * texto sale del fondo (claro u oscuro, el que mas contraste) y el acento se
 * corrige igual si se pierde contra el.
 */
export function paletaDeTarjeta(
  paleta: PaletaTarjeta,
  acento: string | null | undefined,
  fondo?: string | null
): ColoresTarjeta {
  const base = acento && rgb(acento) ? aHex(rgb(acento)!) : ACENTO_POR_DEFECTO;
  const sobre = (color: string) => (luminancia(color) > 0.45 ? "#0F172A" : "#FFFFFF");

  if (fondo && rgb(fondo)) {
    const f = aHex(rgb(fondo)!);
    const oscuro = contraste(f, "#FFFFFF") >= contraste(f, "#0F172A");
    const texto = oscuro ? "#F8FAFC" : "#0F172A";
    const visible = contraste(base, f) < 1.8 ? mezclar(base, texto, 0.5) : base;
    return {
      fondo: f,
      texto,
      textoSuave: mezclar(texto, f, 0.35),
      borde: mezclar(f, texto, 0.14),
      acento: visible,
      sobreAcento: sobre(visible),
      vacio: mezclar(f, texto, 0.08),
      oscuro,
    };
  }

  if (paleta === "oscura") {
    const visible = luminancia(base) < 0.12 ? mezclar(base, "#FFFFFF", 0.45) : base;
    return {
      fondo: "#0F172A",
      texto: "#F8FAFC",
      textoSuave: "#94A3B8",
      borde: "#1E293B",
      acento: visible,
      sobreAcento: sobre(visible),
      vacio: "#1E293B",
      oscuro: true,
    };
  }

  const visible = luminancia(base) > 0.6 ? mezclar(base, "#000000", 0.35) : base;
  return {
    fondo: "#FFFFFF",
    texto: "#0F172A",
    textoSuave: "#64748B",
    borde: "#E2E8F0",
    acento: visible,
    sobreAcento: sobre(visible),
    vacio: "#F1F5F9",
    oscuro: false,
  };
}

// ---------------------------------------------------------------------------
// Tarjeta publica viva
// ---------------------------------------------------------------------------

/** Lo que la tarjeta publica recuerda de la ultima vez que el cliente la abrio. */
export interface VistaTarjeta {
  sellos: number;
  canjes: number;
}

export interface CambioTarjeta {
  /** Indices de la cuadricula que se llenaron desde la ultima vista (para el rebote). */
  nuevos: number[];
  /** Se acaba de completar la tarjeta: confeti y regalo. */
  completa: boolean;
}

/**
 * Que cambio entre la ultima vista y la actual. Sin vista previa (primera vez
 * en este celular) no se anima nada. Si hubo un canje, la cuenta empezo de
 * nuevo: los sellos de ahora son todos nuevos.
 */
export function cambioDeTarjeta(previa: VistaTarjeta | null, actual: VistaTarjeta, meta: number): CambioTarjeta {
  if (!previa) return { nuevos: [], completa: false };
  const ahora = progreso(actual.sellos, meta);
  const desde = actual.canjes > previa.canjes ? 0 : progreso(previa.sellos, meta).llenos;
  const nuevos: number[] = [];
  for (let i = desde; i < ahora.llenos; i++) nuevos.push(i);
  const antesCompleta = actual.canjes === previa.canjes && progreso(previa.sellos, meta).premiosDisponibles > 0;
  return { nuevos, completa: ahora.premiosDisponibles > 0 && !antesCompleta };
}

// ---------------------------------------------------------------------------
// Panel del programa
// ---------------------------------------------------------------------------

/** Lo minimo de una tarjeta para las metricas del panel. */
export interface TarjetaParaPanel {
  sellos: number;
  activa: boolean;
  ultima_visita: string | null;
}

/** Un sello sumado (fecha del movimiento `sello`). */
export interface SelloParaPanel {
  tarjeta_id: string;
  creado_en: string;
}

export interface PanelLealtad {
  /** Tarjetas activas a las que les falta exactamente un sello. */
  aUnSello: number;
  /** Tarjetas activas con un premio completo sin canjear. */
  conPremio: number;
  /** Tarjetas activas que ya vinieron alguna vez y no vuelven desde hace `diasInactivo`. */
  inactivas: number;
  /** Dias promedio entre dos visitas del mismo cliente; null sin datos suficientes. */
  diasEntreVisitas: number | null;
  /** Clientes que volvieron (2 visitas o mas) en la ventana de sellos consultada. */
  recurrentes: number;
  /** Sellos por semana, la mas vieja primero (lunes a domingo). */
  semanas: { inicio: string; sellos: number }[];
}

const DIA_MS = 86_400_000;
/** Sin sello en este lapso, el cliente "dejo de venir". */
export const DIAS_INACTIVO = 30;

/** Tarjeta activa que ya vino alguna vez y no vuelve desde hace `dias`. */
export function esInactiva(t: TarjetaParaPanel, ahora = new Date(), dias = DIAS_INACTIVO): boolean {
  return t.activa && t.ultima_visita != null && new Date(t.ultima_visita).getTime() < ahora.getTime() - dias * DIA_MS;
}

/** Lunes 00:00 (hora local) de la semana de `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Metricas del panel de lealtad a partir de las tarjetas y los sellos de las
 * ultimas `numSemanas` semanas. Una "visita" es un sello: el programa suma uno
 * por venta.
 */
export function panelLealtad(
  tarjetas: TarjetaParaPanel[],
  sellos: SelloParaPanel[],
  meta: number,
  ahora = new Date(),
  { numSemanas = 8, diasInactivo = DIAS_INACTIVO }: { numSemanas?: number; diasInactivo?: number } = {}
): PanelLealtad {
  const activas = tarjetas.filter((t) => t.activa);

  // Semanas: de la mas vieja a la actual.
  const actual = inicioDeSemana(ahora);
  const semanas = Array.from({ length: numSemanas }, (_, i) => {
    const d = new Date(actual);
    d.setDate(d.getDate() - 7 * (numSemanas - 1 - i));
    return { inicio: d, sellos: 0 };
  });
  const porTarjeta = new Map<string, number[]>();
  for (const s of sellos) {
    const t = new Date(s.creado_en);
    if (Number.isNaN(t.getTime())) continue;
    const semana = inicioDeSemana(t).getTime();
    const i = semanas.findIndex((w) => w.inicio.getTime() === semana);
    if (i >= 0) semanas[i].sellos += 1;
    const lista = porTarjeta.get(s.tarjeta_id) ?? [];
    lista.push(t.getTime());
    porTarjeta.set(s.tarjeta_id, lista);
  }

  // Frecuencia: promedio de los huecos entre visitas consecutivas de cada tarjeta.
  let suma = 0;
  let huecos = 0;
  let recurrentes = 0;
  for (const tiempos of porTarjeta.values()) {
    if (tiempos.length < 2) continue;
    recurrentes += 1;
    tiempos.sort((a, b) => a - b);
    for (let i = 1; i < tiempos.length; i++) {
      suma += tiempos[i] - tiempos[i - 1];
      huecos += 1;
    }
  }

  return {
    aUnSello: activas.filter((t) => progreso(t.sellos, meta).faltan === 1).length,
    conPremio: activas.filter((t) => progreso(t.sellos, meta).premiosDisponibles > 0).length,
    inactivas: activas.filter((t) => esInactiva(t, ahora, diasInactivo)).length,
    diasEntreVisitas: huecos ? Math.round((suma / huecos / DIA_MS) * 10) / 10 : null,
    recurrentes,
    semanas: semanas.map((w) => ({ inicio: w.inicio.toISOString(), sellos: w.sellos })),
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
