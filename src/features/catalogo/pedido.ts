import { esFraccionable, formatearCantidad, normalizarCantidad } from "@/lib/unidades";

/**
 * El carrito del catálogo en línea. No es una venta: no cobra ni mueve
 * inventario. Se convierte en un mensaje de WhatsApp para el negocio, que
 * confirma precios y existencias por su lado.
 */

export interface LineaPedido {
  /** producto o producto:variante: la variante es parte de la identidad. */
  clave: string;
  productoId: string;
  varianteId: string | null;
  nombre: string;
  /** "Rojo · M"; null sin variante. */
  variante: string | null;
  unidad: string;
  /** null si el negocio no muestra precios. */
  precio: number | null;
  cantidad: number;
}

export type AccionPedido =
  | { tipo: "agregar"; linea: Omit<LineaPedido, "clave" | "cantidad">; cantidad?: number }
  | { tipo: "cantidad"; clave: string; cantidad: number }
  | { tipo: "quitar"; clave: string }
  | { tipo: "vaciar" };

/** Tope por renglón: un pedido por WhatsApp no es un pedido de bodega. */
export const CANTIDAD_MAXIMA = 9999;

export function claveLinea(productoId: string, varianteId: string | null): string {
  return varianteId ? `${productoId}:${varianteId}` : productoId;
}

/** Lo que suma un "+": 1 en piezas; en granel también 1 (1 kg, 1 m). */
function acotar(cantidad: number, unidad: string): number | null {
  const n = normalizarCantidad(cantidad, unidad);
  if (n == null) return null;
  return Math.min(n, CANTIDAD_MAXIMA);
}

export function reducirPedido(lineas: LineaPedido[], accion: AccionPedido): LineaPedido[] {
  switch (accion.tipo) {
    case "agregar": {
      const clave = claveLinea(accion.linea.productoId, accion.linea.varianteId);
      const suma = accion.cantidad ?? 1;
      const existente = lineas.find((l) => l.clave === clave);
      if (existente) {
        const cantidad = acotar(existente.cantidad + suma, existente.unidad);
        if (cantidad == null) return lineas;
        return lineas.map((l) => (l.clave === clave ? { ...l, cantidad } : l));
      }
      const cantidad = acotar(suma, accion.linea.unidad);
      if (cantidad == null) return lineas;
      return [...lineas, { ...accion.linea, clave, cantidad }];
    }
    case "cantidad": {
      if (!(accion.cantidad > 0)) return lineas.filter((l) => l.clave !== accion.clave);
      return lineas.map((l) => {
        if (l.clave !== accion.clave) return l;
        const cantidad = acotar(accion.cantidad, l.unidad);
        return cantidad == null ? l : { ...l, cantidad };
      });
    }
    case "quitar":
      return lineas.filter((l) => l.clave !== accion.clave);
    case "vaciar":
      return [];
  }
}

/** Piezas para el globo del carrito: un renglón a granel cuenta como 1. */
export function conteoPedido(lineas: LineaPedido[]): number {
  return lineas.reduce((n, l) => n + (esFraccionable(l.unidad) ? 1 : l.cantidad), 0);
}

/** Total estimado, o null si algún renglón no tiene precio. */
export function totalEstimado(lineas: LineaPedido[]): number | null {
  let total = 0;
  for (const l of lineas) {
    if (l.precio == null) return null;
    total += l.precio * l.cantidad;
  }
  return Math.round(total * 100) / 100;
}

export function formatearPrecio(monto: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto);
}

/**
 * El texto que se abre en WhatsApp. Lo escribe el cliente final hacia el
 * negocio, así que va en segunda persona y aclara que los precios los
 * confirma el negocio (el catálogo puede ir un paso atrás del inventario).
 */
export function mensajePedido(negocio: string, lineas: LineaPedido[], nombreCliente?: string): string {
  const renglones = lineas.map((l) => {
    const nombre = l.variante ? `${l.nombre} (${l.variante})` : l.nombre;
    const cantidad = formatearCantidad(l.cantidad, l.unidad);
    const subtotal = l.precio != null ? ` — ${formatearPrecio(l.precio * l.cantidad)}` : "";
    return `• ${cantidad} ${nombre}${subtotal}`;
  });
  const total = totalEstimado(lineas);
  const saludo = nombreCliente?.trim()
    ? `Hola, ${negocio}. Soy ${nombreCliente.trim()} y quiero hacer este pedido:`
    : `Hola, ${negocio}. Quiero hacer este pedido:`;
  return [
    saludo,
    "",
    ...renglones,
    "",
    ...(total != null ? [`Total estimado: ${formatearPrecio(total)}`] : []),
    "¿Me confirman disponibilidad y precio? Gracias.",
    "",
    "(Pedido desde su catálogo en línea)",
  ].join("\n");
}

/** Texto del precio en la tarjeta: "$26.00", "desde $18.00", "$180.00 por kg". */
export function textoPrecio(
  min: number | null,
  max: number | null,
  unidad: string
): string | null {
  if (min == null) return null;
  const sufijo = esFraccionable(unidad) ? ` por ${unidadCorta(unidad)}` : "";
  if (max != null && max > min) return `desde ${formatearPrecio(min)}${sufijo}`;
  return `${formatearPrecio(min)}${sufijo}`;
}

function unidadCorta(unidad: string): string {
  return formatearCantidad(1, unidad).replace(/^1 /, "");
}
