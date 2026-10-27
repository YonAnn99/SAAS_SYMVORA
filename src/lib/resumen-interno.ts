/**
 * Correos internos para el equipo de SYMVORA (hola@): el aviso al momento de
 * cada negocio nuevo y el resumen diario (`/api/cron/resumen-interno`).
 *
 * Solo arma asunto, HTML y texto (puro, probado en
 * `__tests__/resumen-interno.test.ts`); el envio esta en `lib/email.ts`
 * (`sendCorreoInterno`). Los datos salen de `resumen_interno_diario()`
 * (migracion 123), que ya excluye los negocios demo.
 */

export type EstatusSuscripcion = "trial" | "active" | "past_due" | "canceled" | "expired";

interface Contacto {
  dueno: string | null;
  correo: string | null;
  celular: string | null;
}

export interface NegocioNuevo extends Contacto {
  negocio: string;
  giro: string | null;
  origen: string | null;
  creado_en: string;
}

export interface RegistroIncompleto {
  nombre: string | null;
  negocio: string | null;
  celular: string | null;
  correo: string | null;
  origen: string | null;
  creado_en: string;
}

export interface NegocioSinProductos extends Contacto {
  negocio: string;
  giro: string | null;
  estatus: EstatusSuscripcion | null;
  creado_en: string;
}

export interface NegocioInactivo extends Contacto {
  negocio: string;
  giro: string | null;
  estatus: EstatusSuscripcion | null;
  productos: number;
  ventas: number;
  ultima_venta: string | null;
  creado_en: string;
}

export interface PruebaPorVencer extends Contacto {
  negocio: string;
  productos: number;
  ventas: number;
  trial_end: string;
}

export interface PagoRecibido {
  negocio: string;
  monto: number;
  metodo: string | null;
  pagado_en: string;
}

export interface VencidoOCancelado extends Contacto {
  negocio: string;
  motivo: "cancelada" | "pago_vencido";
  fecha: string;
}

export interface ResumenInterno {
  nuevos: NegocioNuevo[];
  incompletos: RegistroIncompleto[];
  sin_productos: NegocioSinProductos[];
  inactivos: NegocioInactivo[];
  por_vencer: PruebaPorVencer[];
  pagos: PagoRecibido[];
  vencidos_cancelados: VencidoOCancelado[];
}

export interface CorreoInterno {
  subject: string;
  html: string;
  text: string;
}

/** Filas maximas por seccion: el resto se resume en "y N mas". */
export const MAX_FILAS_SECCION = 25;

const AZUL = "#1E3A8A";
const TINTA = "#111827";
const GRIS = "#6B7280";
const BORDE = "#E5E7EB";
const ZONA = "America/Mexico_City";
const DIA_MS = 24 * 60 * 60 * 1000;

/** Escapa texto que escribio un usuario antes de meterlo en el HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function o(valor: string | null | undefined, vacio = "—"): string {
  const limpio = (valor ?? "").trim();
  return limpio ? limpio : vacio;
}

export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Dias completos entre `desde` y `ahora`. */
export function diasDesde(desde: string, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - new Date(desde).getTime()) / DIA_MS));
}

/** "hace 5 h", "hace 2 días". */
export function haceCuanto(desde: string, ahora: Date): string {
  const horas = Math.max(0, Math.floor((ahora.getTime() - new Date(desde).getTime()) / 3_600_000));
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/** Texto del detalle de un inactivo: nunca ha vendido o cuantos dias sin vender. */
export function detalleInactivo(n: NegocioInactivo, ahora: Date): string {
  const productos = `${n.productos} ${n.productos === 1 ? "producto" : "productos"}`;
  if (n.ventas === 0 || !n.ultima_venta) {
    return `Nunca ha vendido (${diasDesde(n.creado_en, ahora)} días de alta) · ${productos}`;
  }
  return `Sin vender hace ${diasDesde(n.ultima_venta, ahora)} días · ${productos}`;
}

export function etiquetaOrigen(origen: string | null): string {
  if (!origen) return "—";
  const valor = origen.toLowerCase();
  if (valor === "google") return "Google";
  if (valor === "email" || valor === "correo") return "Correo";
  return origen;
}

export function etiquetaEstatus(estatus: EstatusSuscripcion | null): string {
  switch (estatus) {
    case "trial":
      return "Prueba";
    case "active":
      return "Activa";
    case "past_due":
      return "Pago vencido";
    case "canceled":
      return "Cancelada";
    case "expired":
      return "Vencida";
    default:
      return "—";
  }
}

const METODOS_PAGO: Record<string, string> = {
  card: "Tarjeta",
  oxxo: "OXXO",
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  spei: "SPEI",
  pay_by_bank: "Pago Directo BBVA",
  bnpl: "Aplazo",
  apple: "Apple Pay",
  google: "Google Pay",
  manual: "Manual",
};

/** Metodo de pago del enum `payment_method` en español. */
export function etiquetaMetodoPago(metodo: string | null): string {
  if (!metodo) return "—";
  return METODOS_PAGO[metodo] ?? metodo;
}

function pesos(monto: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto);
}

/** Celular con enlace a WhatsApp para escribirle directo desde el correo. */
function celularHtml(celular: string | null): string {
  const digitos = (celular ?? "").replace(/\D/g, "");
  if (!digitos) return "—";
  return `<a href="https://wa.me/${digitos}" style="color:${AZUL};text-decoration:none;">${esc(celular as string)}</a>`;
}

function contactoHtml(c: { correo: string | null; celular: string | null }): string {
  const correo = c.correo
    ? `<a href="mailto:${esc(c.correo)}" style="color:${AZUL};text-decoration:none;">${esc(c.correo)}</a>`
    : "—";
  return `${correo}<br>${celularHtml(c.celular)}`;
}

function contactoTexto(c: { correo: string | null; celular: string | null }): string {
  return [o(c.correo, ""), o(c.celular, "")].filter(Boolean).join(" · ") || "sin contacto";
}

interface Seccion<T> {
  titulo: string;
  vacio: string;
  filas: T[];
  columnas: { titulo: string; html: (f: T) => string }[];
  texto: (f: T) => string;
}

function tablaHtml<T>(s: Seccion<T>): string {
  const total = s.filas.length;
  const encabezado = `<h2 style="margin:28px 0 8px;font-size:16px;color:${AZUL};">${esc(s.titulo)} <span style="color:${GRIS};font-weight:400;">(${total})</span></h2>`;
  if (total === 0) {
    return `${encabezado}<p style="margin:0;font-size:13px;color:${GRIS};">${esc(s.vacio)}</p>`;
  }
  const visibles = s.filas.slice(0, MAX_FILAS_SECCION);
  const cabeza = s.columnas
    .map(
      (c) =>
        `<th align="left" style="font-size:11px;color:${GRIS};text-transform:uppercase;font-weight:600;padding:6px 8px;border-bottom:1px solid ${BORDE};">${esc(c.titulo)}</th>`
    )
    .join("");
  const cuerpo = visibles
    .map(
      (f) =>
        `<tr>${s.columnas
          .map(
            (c) =>
              `<td valign="top" style="font-size:13px;color:${TINTA};padding:8px;border-bottom:1px solid ${BORDE};">${c.html(f)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  const mas =
    total > visibles.length
      ? `<p style="margin:6px 0 0;font-size:12px;color:${GRIS};">y ${total - visibles.length} más.</p>`
      : "";
  return `${encabezado}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><thead><tr>${cabeza}</tr></thead><tbody>${cuerpo}</tbody></table>${mas}`;
}

function bloqueTexto<T>(s: Seccion<T>): string {
  const lineas = s.filas.slice(0, MAX_FILAS_SECCION).map((f) => `- ${s.texto(f)}`);
  if (s.filas.length > MAX_FILAS_SECCION) lineas.push(`  y ${s.filas.length - MAX_FILAS_SECCION} más.`);
  return `${s.titulo} (${s.filas.length})\n${s.filas.length ? lineas.join("\n") : s.vacio}`;
}

function documento(titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
<tr><td style="background:${AZUL};padding:18px 24px;color:#FFFFFF;font-size:13px;letter-spacing:1px;font-weight:700;">SYMVORA · INTERNO</td></tr>
<tr><td style="padding:8px 24px 28px;">${cuerpo}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Cuantas novedades hay en total (para el asunto y para "sin novedades"). */
export function totalNovedades(r: ResumenInterno): number {
  return (
    r.nuevos.length +
    r.incompletos.length +
    r.sin_productos.length +
    r.inactivos.length +
    r.por_vencer.length +
    r.pagos.length +
    r.vencidos_cancelados.length
  );
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function asuntoResumen(r: ResumenInterno, ahora: Date): string {
  const partes = [
    r.nuevos.length && plural(r.nuevos.length, "nuevo", "nuevos"),
    r.incompletos.length && plural(r.incompletos.length, "incompleto", "incompletos"),
    r.sin_productos.length && plural(r.sin_productos.length, "sin productos", "sin productos"),
    r.inactivos.length && plural(r.inactivos.length, "inactivo", "inactivos"),
    r.por_vencer.length && plural(r.por_vencer.length, "prueba por vencer", "pruebas por vencer"),
    r.pagos.length && plural(r.pagos.length, "pago", "pagos"),
    r.vencidos_cancelados.length &&
      plural(r.vencidos_cancelados.length, "vencido/cancelado", "vencidos/cancelados"),
  ].filter(Boolean);
  const fecha = fechaCorta(ahora.toISOString());
  return `Resumen SYMVORA · ${fecha} · ${partes.length ? partes.join(" · ") : "sin novedades"}`;
}

/** Resumen diario para hola@: una seccion por lista, vacias con "Nada nuevo". */
export function construirCorreoResumenInterno(r: ResumenInterno, ahora: Date): CorreoInterno {
  const nuevos: Seccion<NegocioNuevo> = {
    titulo: "Negocios nuevos (últimas 24 h)",
    vacio: "Nada nuevo.",
    filas: r.nuevos,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong><br><span style="color:${GRIS};">${esc(o(f.giro))}</span>` },
      { titulo: "Dueño", html: (f) => esc(o(f.dueno)) },
      { titulo: "Contacto", html: contactoHtml },
      { titulo: "Alta", html: (f) => `${esc(fechaHora(f.creado_en))}<br><span style="color:${GRIS};">${esc(etiquetaOrigen(f.origen))}</span>` },
    ],
    texto: (f) => `${f.negocio} (${o(f.giro)}) · ${o(f.dueno)} · ${contactoTexto(f)} · ${etiquetaOrigen(f.origen)}`,
  };

  const incompletos: Seccion<RegistroIncompleto> = {
    titulo: "Registros incompletos (últimos 3 días)",
    vacio: "Nada nuevo.",
    filas: r.incompletos,
    columnas: [
      { titulo: "Nombre", html: (f) => `<strong>${esc(o(f.nombre, "Sin nombre"))}</strong><br><span style="color:${GRIS};">${esc(o(f.negocio))}</span>` },
      { titulo: "Contacto", html: contactoHtml },
      { titulo: "Origen", html: (f) => esc(etiquetaOrigen(f.origen)) },
      { titulo: "Cuándo", html: (f) => esc(haceCuanto(f.creado_en, ahora)) },
    ],
    texto: (f) =>
      `${o(f.nombre, "Sin nombre")} (${o(f.negocio)}) · ${contactoTexto(f)} · ${etiquetaOrigen(f.origen)} · ${haceCuanto(f.creado_en, ahora)}`,
  };

  const sinProductos: Seccion<NegocioSinProductos> = {
    titulo: "Sin productos cargados (más de 2 días)",
    vacio: "Nada nuevo.",
    filas: r.sin_productos,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong><br><span style="color:${GRIS};">${esc(etiquetaEstatus(f.estatus))}</span>` },
      { titulo: "Dueño", html: (f) => esc(o(f.dueno)) },
      { titulo: "Contacto", html: contactoHtml },
      { titulo: "Alta", html: (f) => esc(`${haceCuanto(f.creado_en, ahora)}`) },
    ],
    texto: (f) => `${f.negocio} · ${o(f.dueno)} · ${contactoTexto(f)} · alta ${haceCuanto(f.creado_en, ahora)}`,
  };

  const inactivos: Seccion<NegocioInactivo> = {
    titulo: "Inactivos (7 días sin vender o nunca tras 3 días)",
    vacio: "Nada nuevo.",
    filas: r.inactivos,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong><br><span style="color:${GRIS};">${esc(etiquetaEstatus(f.estatus))}</span>` },
      { titulo: "Dueño", html: (f) => esc(o(f.dueno)) },
      { titulo: "Contacto", html: contactoHtml },
      { titulo: "Detalle", html: (f) => esc(detalleInactivo(f, ahora)) },
    ],
    texto: (f) => `${f.negocio} · ${o(f.dueno)} · ${contactoTexto(f)} · ${detalleInactivo(f, ahora)}`,
  };

  const porVencer: Seccion<PruebaPorVencer> = {
    titulo: "Pruebas por vencer (próximos 3 días)",
    vacio: "Nada nuevo.",
    filas: r.por_vencer,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong>` },
      { titulo: "Dueño", html: (f) => esc(o(f.dueno)) },
      { titulo: "Contacto", html: contactoHtml },
      { titulo: "Vence", html: (f) => `${esc(fechaHora(f.trial_end))}<br><span style="color:${GRIS};">${f.productos} prod. · ${f.ventas} ventas</span>` },
    ],
    texto: (f) => `${f.negocio} · ${o(f.dueno)} · ${contactoTexto(f)} · vence ${fechaHora(f.trial_end)} · ${f.productos} productos, ${f.ventas} ventas`,
  };

  const pagos: Seccion<PagoRecibido> = {
    titulo: "Pagos recibidos (últimas 24 h)",
    vacio: "Nada nuevo.",
    filas: r.pagos,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong>` },
      { titulo: "Monto", html: (f) => esc(pesos(Number(f.monto))) },
      { titulo: "Método", html: (f) => esc(etiquetaMetodoPago(f.metodo)) },
      { titulo: "Cuándo", html: (f) => esc(fechaHora(f.pagado_en)) },
    ],
    texto: (f) => `${f.negocio} · ${pesos(Number(f.monto))} · ${etiquetaMetodoPago(f.metodo)} · ${fechaHora(f.pagado_en)}`,
  };

  const vencidos: Seccion<VencidoOCancelado> = {
    titulo: "Pagos vencidos y cancelaciones (últimas 24 h)",
    vacio: "Nada nuevo.",
    filas: r.vencidos_cancelados,
    columnas: [
      { titulo: "Negocio", html: (f) => `<strong>${esc(f.negocio)}</strong>` },
      { titulo: "Dueño", html: (f) => esc(o(f.dueno)) },
      { titulo: "Contacto", html: contactoHtml },
      {
        titulo: "Qué pasó",
        html: (f) => esc(f.motivo === "cancelada" ? "Canceló su suscripción" : "Pago vencido"),
      },
    ],
    texto: (f) =>
      `${f.negocio} · ${o(f.dueno)} · ${contactoTexto(f)} · ${f.motivo === "cancelada" ? "canceló" : "pago vencido"}`,
  };

  const secciones = [nuevos, incompletos, sinProductos, inactivos, porVencer, pagos, vencidos];
  const subject = asuntoResumen(r, ahora);
  const intro =
    totalNovedades(r) === 0
      ? "Sin novedades en las últimas 24 horas. El resumen corrió bien."
      : "Lo que pasó con los negocios de SYMVORA (sin contar demos). El celular abre WhatsApp.";

  const cuerpo =
    `<h1 style="margin:20px 0 4px;font-size:20px;color:${TINTA};">Resumen diario</h1>` +
    `<p style="margin:0;font-size:13px;color:${GRIS};">${esc(fechaHora(ahora.toISOString()))} · ${esc(intro)}</p>` +
    // Cada seccion trae sus propios tipos de fila; el arreglo las mezcla.
    secciones.map((s) => tablaHtml(s as Seccion<unknown>)).join("");

  const text = [
    "Resumen diario SYMVORA",
    intro,
    ...secciones.map((s) => bloqueTexto(s as Seccion<unknown>)),
  ].join("\n\n");

  return { subject, html: documento(subject, cuerpo), text };
}

/** Aviso al momento: alguien acaba de crear su negocio. */
export function construirCorreoNuevoNegocio(n: NegocioNuevo & { referido?: string | null }): CorreoInterno {
  const subject = `Nuevo negocio: ${n.negocio}`;
  const filas: [string, string][] = [
    ["Negocio", `<strong>${esc(n.negocio)}</strong>`],
    ["Giro", esc(o(n.giro))],
    ["Dueño", esc(o(n.dueno))],
    ["Correo", n.correo ? `<a href="mailto:${esc(n.correo)}" style="color:${AZUL};">${esc(n.correo)}</a>` : "—"],
    ["Celular", celularHtml(n.celular)],
    ["Registro con", esc(etiquetaOrigen(n.origen))],
    ["Fecha", esc(fechaHora(n.creado_en))],
  ];
  if (n.referido) filas.push(["Código de referido", esc(n.referido)]);

  const tabla = filas
    .map(
      ([k, v]) =>
        `<tr><td style="font-size:12px;color:${GRIS};padding:8px 12px 8px 0;border-bottom:1px solid ${BORDE};white-space:nowrap;">${esc(k)}</td><td style="font-size:14px;color:${TINTA};padding:8px 0;border-bottom:1px solid ${BORDE};">${v}</td></tr>`
    )
    .join("");

  const cuerpo =
    `<h1 style="margin:20px 0 4px;font-size:20px;color:${TINTA};">Nuevo negocio en SYMVORA</h1>` +
    `<p style="margin:0 0 16px;font-size:13px;color:${GRIS};">Acaba de terminar su registro y empezó su prueba.</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${tabla}</table>`;

  const text = [
    "Nuevo negocio en SYMVORA",
    `Negocio: ${n.negocio}`,
    `Giro: ${o(n.giro)}`,
    `Dueño: ${o(n.dueno)}`,
    `Correo: ${o(n.correo)}`,
    `Celular: ${o(n.celular)}`,
    `Registro con: ${etiquetaOrigen(n.origen)}`,
    `Fecha: ${fechaHora(n.creado_en)}`,
    ...(n.referido ? [`Código de referido: ${n.referido}`] : []),
  ].join("\n");

  return { subject, html: documento(subject, cuerpo), text };
}
