/**
 * Insumos por servicio (migracion 117): logica pura.
 *
 * Un servicio (consulta, vacuna, esterilizacion) tiene su receta: los
 * productos que usa por cada unidad vendida. Al cobrarlo, el servidor
 * (`_crear_venta_desde_items`) los descuenta de la sucursal con sus lotes.
 * En el POS se pueden ajustar para ESA venta; entonces la linea lleva sus
 * propios `insumos` con las cantidades TOTALES (no por unidad).
 */

export interface InsumoLinea {
  productId: string;
  varianteId: string | null;
  cantidad: number;
  /** Solo para mostrar ("Vacuna triple · 1 ml"). */
  nombre: string;
}

/** Recetas por servicio: `servicio_id -> insumos por UNA unidad`. */
export type RecetasServicio = Map<string, InsumoLinea[]>;

function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Une repetidos (mismo producto y variante) y quita lo que quedo en 0. */
export function normalizarInsumos(insumos: InsumoLinea[]): InsumoLinea[] {
  const porClave = new Map<string, InsumoLinea>();
  for (const i of insumos) {
    const cantidad = Number(i.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    const clave = `${i.productId}::${i.varianteId ?? ""}`;
    const previo = porClave.get(clave);
    porClave.set(
      clave,
      previo
        ? { ...previo, cantidad: redondear(previo.cantidad + cantidad) }
        : { ...i, cantidad: redondear(cantidad) }
    );
  }
  return [...porClave.values()];
}

/**
 * Lo que va a usar una linea del carrito: lo ajustado para esta venta o, si no
 * se ajusto, la receta por la cantidad vendida. `null` si el servicio no tiene
 * receta (no hay nada que mostrar).
 */
export function insumosDeLinea(
  linea: { productId: string; cantidad: number; insumos?: InsumoLinea[] | null },
  recetas: RecetasServicio
): InsumoLinea[] | null {
  if (linea.insumos) return linea.insumos;
  const receta = recetas.get(linea.productId);
  if (!receta || receta.length === 0) return null;
  return receta.map((i) => ({ ...i, cantidad: redondear(i.cantidad * linea.cantidad) }));
}

/** "1 Vacuna triple · 2 Jeringa 3 ml" */
export function textoInsumos(insumos: InsumoLinea[]): string {
  if (insumos.length === 0) return "Sin insumos";
  return insumos.map((i) => `${redondear(i.cantidad)} ${i.nombre}`).join(" · ");
}

/** Lo que viaja al servidor: sin nombres (el servidor no confia en ellos). */
export function insumosParaRpc(
  insumos: InsumoLinea[] | null | undefined
): { productId: string; varianteId: string | null; cantidad: number }[] | undefined {
  if (!insumos) return undefined;
  return normalizarInsumos(insumos).map((i) => ({
    productId: i.productId,
    varianteId: i.varianteId,
    cantidad: i.cantidad,
  }));
}
