import { z } from "zod";
import { formatMoneda, type Moneda } from "@/lib/money";
import { formatearCantidad } from "@/lib/unidades";
import type { LineaPedido } from "./pedido";

/**
 * Pedidos del catálogo en línea (migración 141): lo que viaja del cliente final al servidor, los estados y los
 * textos. Lógica pura, sin I/O, para probarla. La ruta `POST /api/catalogo/[slug]/pedido` y el formulario del
 * catálogo comparten estas reglas; la base las vuelve a aplicar (`crear_pedido_publico`), que es la que manda.
 */

export const ESTADOS_PEDIDO = [
  "nuevo",
  "confirmado",
  "pago",
  "en_produccion",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export type EntregaPedido = "recoger" | "domicilio";

/** Los topes de la base (`crear_pedido_publico`): si cambia uno, cambia el otro. */
export const MAX_RENGLONES_PEDIDO = 50;
export const DIRECCION_MIN = 5;
export const DIRECCION_MAX = 200;
export const NOTA_MAX = 300;

export function esEstadoPedido(valor: unknown): valor is EstadoPedido {
  return typeof valor === "string" && (ESTADOS_PEDIDO as readonly string[]).includes(valor);
}

/** Estados que ya no cambian. */
export function estadoFinal(estado: EstadoPedido): boolean {
  return estado === "entregado" || estado === "cancelado";
}

/** Texto para el cliente final (la página pública del catálogo va siempre en español). */
export const ETIQUETA_ESTADO_PUBLICO: Record<EstadoPedido, string> = {
  nuevo: "Recibido: esperando confirmación",
  confirmado: "Confirmado",
  pago: "Pago recibido",
  en_produccion: "En preparación",
  listo: "Listo",
  en_camino: "Va en camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Pasos que se pintan en la línea de seguimiento (sin «cancelado»; «en camino» solo a domicilio). */
export function pasosSeguimiento(entrega: EntregaPedido): EstadoPedido[] {
  const pasos: EstadoPedido[] = ["nuevo", "confirmado", "pago", "en_produccion", "listo", "en_camino", "entregado"];
  return entrega === "recoger" ? pasos.filter((p) => p !== "en_camino") : pasos;
}

export const esquemaPedidoPublico = z.object({
  nombre: z.string().max(120),
  pais: z.string().max(4),
  numero: z.string().max(30),
  entrega: z.enum(["recoger", "domicilio"]),
  direccion: z.string().max(400).optional().default(""),
  nota: z.string().max(600).optional().default(""),
  items: z
    .array(
      z.object({
        productoId: z.uuid(),
        varianteId: z.uuid().nullable().optional(),
        cantidad: z.number().positive().max(9999),
      })
    )
    .min(1)
    .max(MAX_RENGLONES_PEDIDO),
  acepto: z.literal(true),
  token: z.string().max(4096).nullable().optional(),
  /** Campo trampa: invisible para una persona; un bot lo llena. */
  sitio: z.string().max(200).optional(),
});
export type PedidoPublicoEntrada = z.infer<typeof esquemaPedidoPublico>;

/** Quita saltos de línea y espacios repetidos; así viaja y así lo guarda la base. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function direccionValida(direccion: string): boolean {
  const d = limpiarTexto(direccion);
  return d.length >= DIRECCION_MIN && d.length <= DIRECCION_MAX;
}

/** Del carrito a lo que recibe la ruta. */
export function lineasAItems(lineas: LineaPedido[]): { productoId: string; varianteId: string | null; cantidad: number }[] {
  return lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad }));
}

/** Lo que responde la ruta al crear el pedido. */
export interface ResultadoPedido {
  folio: number;
  codigo: string;
  total: number;
}

/**
 * Mensajes de la base (sin acentos) → lo que lee el cliente y el código HTTP. `null` = no se reconoce: es un
 * fallo nuestro y se responde genérico (el texto crudo nunca sale).
 */
const MENSAJES: [RegExp, string, number][] = [
  [/productos de tu pedido/i, "Algunos productos ya no están disponibles. Revisa tu pedido.", 409],
  [/no recibe pedidos/i, "Este catálogo ya no recibe pedidos. Escríbele al negocio por WhatsApp.", 409],
  [/no estan disponibles por ahora/i, "Los pedidos no están disponibles por ahora. Escríbele al negocio por WhatsApp.", 409],
  [/mas pedidos aqui/i, "Hoy ya no se pueden recibir más pedidos aquí. Intenta mañana o escríbele al negocio.", 429],
  [/esperando confirmacion/i, "Ya tienes pedidos esperando confirmación con este celular. Espera a que el negocio los confirme.", 429],
  [/tu nombre/i, "Escribe tu nombre (de 2 a 60 letras).", 400],
  [/celular/i, "Revisa tu número de celular.", 400],
  [/direccion/i, "Escribe tu dirección de entrega.", 400],
  [/nota es demasiado larga/i, "La nota es demasiado larga.", 400],
  [/vacio o es demasiado grande/i, "Tu pedido está vacío o es demasiado grande.", 400],
  [/cantidades/i, "Revisa las cantidades de tu pedido.", 400],
  [/recoges o te lo llevan/i, "Elige si recoges o te lo llevan.", 400],
];

export function mensajeDeErrorPedido(mensajeBase: string | null | undefined): { mensaje: string; status: number } | null {
  const texto = mensajeBase ?? "";
  const conocido = MENSAJES.find(([patron]) => patron.test(texto));
  return conocido ? { mensaje: conocido[1], status: conocido[2] } : null;
}

/**
 * El texto de WhatsApp tras guardar el pedido: lleva el folio y el enlace de seguimiento. Es el mismo estilo de
 * `mensajePedido`, pero el pedido ya está guardado: el negocio lo confirma desde su panel.
 */
export function mensajeConFolio(
  negocio: string,
  folio: number,
  lineas: LineaPedido[],
  urlSeguimiento: string,
  moneda: Moneda = "MXN"
): string {
  const renglones = lineas.map((l) => {
    const nombre = l.variante ? `${l.nombre} (${l.variante})` : l.nombre;
    return `• ${formatearCantidad(l.cantidad, l.unidad)} ${nombre}`;
  });
  const total = lineas.every((l) => l.precio != null)
    ? Math.round(lineas.reduce((s, l) => s + (l.precio as number) * l.cantidad, 0) * 100) / 100
    : null;
  return [
    `Hola, ${negocio}. Acabo de hacer el pedido #${folio} desde su catálogo:`,
    "",
    ...renglones,
    ...(total != null ? ["", `Total estimado: ${formatMoneda(total, moneda)}`] : []),
    "",
    `Seguimiento: ${urlSeguimiento}`,
  ].join("\n");
}
