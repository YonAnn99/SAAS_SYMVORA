/**
 * Las opciones del selector de productos de una orden de compra.
 *
 * Una orden puede pedir el producto suelto o **una variante concreta**, y eso
 * no es un capricho: el stock de una variante vive en
 * `variantes_producto.stock_actual`, SEPARADO del de su producto padre. Pedir
 * "sueter" cuando lo que falta es la talla M deja el inventario mal aunque el
 * numero total cuadre.
 */

export interface ProductoOpcion {
  id: string;
  nombre: string;
  costo_compra: number;
}

export interface VarianteOpcion {
  id: string;
  producto_id: string;
  talla: string | null;
  color: string | null;
  costo_compra: number;
}

export interface OpcionCompra {
  /** Clave del combobox. Codifica producto y variante. */
  value: string;
  label: string;
  productoId: string;
  varianteId: string | null;
  costo: number;
  /** Texto extra por el que se puede buscar (nombre del padre, talla, color). */
  keywords: string;
}

const SEPARADOR = "::";

/** `"prod"` o `"prod::variante"`. */
export function componerValor(
  productoId: string,
  varianteId: string | null
): string {
  return varianteId ? `${productoId}${SEPARADOR}${varianteId}` : productoId;
}

export function descomponerValor(value: string): {
  productoId: string;
  varianteId: string | null;
} {
  const [productoId, varianteId] = value.split(SEPARADOR);
  return { productoId, varianteId: varianteId ?? null };
}

/** "M / ROJO", "M", "ROJO" o "Variante" si no tiene ninguno de los dos. */
export function etiquetaVariante(v: {
  talla: string | null;
  color: string | null;
}): string {
  const partes = [v.talla, v.color].filter(Boolean);
  return partes.length > 0 ? partes.join(" / ") : "Variante";
}

/**
 * Construye la lista del selector: cada producto, y debajo sus variantes.
 *
 * El producto padre se ofrece SIEMPRE, incluso teniendo variantes: hay compras
 * que entran al stock general (una caja sin desglosar) y quitarlo obligaria a
 * inventarse una variante para poder pedir.
 */
export function construirOpciones(
  productos: ProductoOpcion[],
  variantes: VarianteOpcion[]
): OpcionCompra[] {
  const opciones: OpcionCompra[] = [];

  for (const p of productos) {
    opciones.push({
      value: componerValor(p.id, null),
      label: p.nombre,
      productoId: p.id,
      varianteId: null,
      costo: Number(p.costo_compra) || 0,
      keywords: p.nombre,
    });

    // Un producto marcado `permite_variantes` pero SIN variantes creadas no
    // aporta ninguna linea extra. Es el mismo caso que ya se contempla en el
    // punto de venta: el switch esta activo pero nadie dio de alta las tallas.
    for (const v of variantes.filter((v) => v.producto_id === p.id)) {
      const sufijo = etiquetaVariante(v);
      opciones.push({
        value: componerValor(p.id, v.id),
        label: `${p.nombre} · ${sufijo}`,
        productoId: p.id,
        varianteId: v.id,
        // La variante tiene su PROPIO costo. Usar el del padre haria que la
        // orden se valorara mal y, al recibir, se escribiera el costo
        // equivocado.
        costo: Number(v.costo_compra) || 0,
        keywords: `${p.nombre} ${sufijo}`,
      });
    }
  }

  return opciones;
}

/** La opción que corresponde a una línea ya guardada. */
export function buscarOpcion(
  opciones: OpcionCompra[],
  productoId: string,
  varianteId: string | null
): OpcionCompra | undefined {
  return opciones.find((o) => o.value === componerValor(productoId, varianteId));
}
