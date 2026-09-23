import { indexarStock, type FilaStockSucursal } from "@/features/sucursales/stock";

export interface OpcionTraspaso {
  /** `productoId:varianteId` (variante vacia = producto suelto). */
  valor: string;
  productoId: string;
  varianteId: string | null;
  etiqueta: string;
  disponible: number;
}

/**
 * Que se puede traspasar desde un local: lo que HAY ahi, y cuanto.
 *
 * - Sin existencias en el origen no se ofrece: elegirlo solo serviria para que
 *   el servidor lo rechazara despues.
 * - Los servicios nunca: no tienen existencias que mover (el servidor tambien
 *   los rechaza, migracion 083).
 * - Cada talla/color es una opcion aparte, porque su stock es aparte. El stock
 *   "sin clasificar" del producto (variante NULL) es otra opcion mas.
 */
export function opcionesDeTraspaso(
  productos: readonly { id: string; nombre: string; es_servicio: boolean | null }[],
  variantes: readonly { id: string; producto_id: string; talla: string | null; color: string | null }[],
  filas: readonly FilaStockSucursal[]
): OpcionTraspaso[] {
  const idx = indexarStock(filas);
  const nombres = new Map(productos.map((p) => [p.id, p]));
  const opciones: OpcionTraspaso[] = [];

  for (const p of productos) {
    if (p.es_servicio) continue;
    const cant = Number(idx.get(`${p.id}:`)?.cantidad ?? 0);
    if (cant > 0) {
      opciones.push({ valor: `${p.id}:`, productoId: p.id, varianteId: null, etiqueta: p.nombre, disponible: cant });
    }
  }

  for (const v of variantes) {
    const padre = nombres.get(v.producto_id);
    if (!padre || padre.es_servicio) continue;
    const cant = Number(idx.get(`${v.producto_id}:${v.id}`)?.cantidad ?? 0);
    if (cant <= 0) continue;
    const detalle = [v.talla, v.color].filter(Boolean).join(" / ");
    opciones.push({
      valor: `${v.producto_id}:${v.id}`,
      productoId: v.producto_id,
      varianteId: v.id,
      etiqueta: detalle ? `${padre.nombre} · ${detalle}` : padre.nombre,
      disponible: cant,
    });
  }

  return opciones.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}
