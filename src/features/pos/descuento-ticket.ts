/**
 * Descuento manual a TODA la compra, en porcentaje o en monto fijo.
 *
 * La base ya guarda el descuento por renglón (`detalle_ventas.descuento`) y
 * calcula el IVA después de descontar. Así que el descuento del ticket se
 * reparte entre los renglones y viaja como ya viajaba: no hace falta tocar el
 * cobro, el ticket ni los reportes.
 *
 * En el carrito vive como INTENCIÓN ("10 %"), no horneado en los renglones:
 * si después se agrega un artículo, el 10 % sigue siendo 10 %.
 */

export type TipoDescuento = "porcentaje" | "monto";

export interface DescuentoTicket {
  tipo: TipoDescuento;
  valor: number;
}

/** Tope del cajero: el servidor lo vuelve a validar (migración 094). */
export const TOPE_DESCUENTO_CAJERO_PCT = 10;

interface LineaConImporte {
  precioUnitario: number;
  cantidad: number;
  descuento: number;
}

const aCentavos = (n: number) => Math.round(n * 100);

/** Importe de un renglón en centavos, igual que lo redondea el servidor. */
function importeCentavos(l: LineaConImporte): number {
  return aCentavos(l.precioUnitario * l.cantidad);
}

/**
 * Cuánto se descuenta, en pesos. El porcentaje se redondea a centavos; el
 * monto no puede pasar del subtotal (no hay tickets negativos).
 */
export function montoDescuento(
  subtotal: number,
  descuento: DescuentoTicket | null
): number {
  if (!descuento || !(descuento.valor > 0) || !(subtotal > 0)) return 0;
  const pesos =
    descuento.tipo === "porcentaje"
      ? (subtotal * Math.min(descuento.valor, 100)) / 100
      : descuento.valor;
  return Math.min(aCentavos(pesos), aCentavos(subtotal)) / 100;
}

/**
 * Reparte el descuento del ticket entre los renglones, proporcional a su
 * importe y en centavos enteros.
 *
 * El sobrante del redondeo se asigna de a un centavo a los renglones con más
 * margen, así la suma cuadra EXACTO con el monto y ningún renglón pasa de su
 * importe (el servidor lo topa, y si lo topara la suma ya no cuadraría con lo
 * que vio el cliente).
 */
export function repartirDescuento<T extends LineaConImporte>(
  items: T[],
  descuento: DescuentoTicket | null
): T[] {
  const importes = items.map(importeCentavos);
  const subtotal = importes.reduce((a, b) => a + b, 0);
  const total = aCentavos(montoDescuento(subtotal / 100, descuento));
  if (total === 0 || subtotal === 0) return items;

  const partes = importes.map((imp) => Math.floor((total * imp) / subtotal));
  let resto = total - partes.reduce((a, b) => a + b, 0);

  // Renglones con más margen primero: ahí cabe el centavo sobrante.
  const orden = importes
    .map((imp, i) => ({ i, margen: imp - partes[i] }))
    .sort((a, b) => b.margen - a.margen);
  for (let k = 0; resto > 0 && orden.length > 0; k = (k + 1) % orden.length) {
    const { i } = orden[k];
    if (partes[i] < importes[i]) {
      partes[i] += 1;
      resto -= 1;
    }
  }

  return items.map((item, i) => ({ ...item, descuento: partes[i] / 100 }));
}

/** Etiqueta de la línea del carrito: "Descuento (10 %)" o "Descuento". */
export function etiquetaDescuento(descuento: DescuentoTicket | null): string {
  if (descuento?.tipo === "porcentaje") {
    return `Descuento (${Number(descuento.valor.toFixed(2))} %)`;
  }
  return "Descuento";
}

/**
 * Valida lo que se escribió antes de aplicarlo. Devuelve el mensaje de error
 * o `null` si está bien.
 */
export function validarDescuento(
  descuento: DescuentoTicket,
  subtotal: number,
  topePct: number | null
): string | null {
  if (!(descuento.valor > 0)) return "Escribe un descuento mayor que cero";
  if (descuento.tipo === "porcentaje" && descuento.valor > 100) {
    return "El porcentaje no puede pasar de 100";
  }
  if (descuento.tipo === "monto" && descuento.valor > subtotal) {
    return "El descuento no puede ser mayor que el subtotal";
  }
  if (topePct !== null) {
    const pct =
      descuento.tipo === "porcentaje"
        ? descuento.valor
        : subtotal > 0
          ? (descuento.valor / subtotal) * 100
          : 0;
    if (pct > topePct + 1e-9) {
      return `Puedes descontar como máximo ${topePct} % del ticket`;
    }
  }
  return null;
}
