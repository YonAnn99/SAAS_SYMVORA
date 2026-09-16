/**
 * Reglas de las listas de precios.
 *
 * Una lista es una agrupacion de productos con precios propios: liquidacion,
 * mayoreo, precio de distribuidor. Vive aparte de los componentes, como
 * `stock-status.ts` y `purchase-receipt.ts`, porque es lo unico con logica y lo
 * unico que merece test.
 */

export type Direccion = "aumentar" | "disminuir";

export interface FilaLista {
  producto_id: string;
  variante_id: string | null;
  /** El precio del catalogo. */
  precio_base: number;
  /** `null` = "No definido": esta en la lista pero sin precio propio. */
  precio: number | null;
}

/**
 * Identidad de una fila.
 *
 * Un producto suelto y una de sus variantes son filas DISTINTAS de la misma
 * lista. Mismo truco que `cartLineKey` en el carrito del punto de venta.
 */
export function claveFila(
  productoId: string,
  varianteId: string | null
): string {
  return `${productoId}::${varianteId ?? "general"}`;
}

/**
 * El precio con el que se vende realmente.
 *
 * ⚠️ `?? `, NO `||`. Con `||` un precio de 0 —un producto de cortesia o un
 * regalo— caeria al precio base y se cobraria. `null` es "no definido"; 0 es
 * "cero pesos", y son cosas distintas.
 */
export function precioEfectivo(
  precioBase: number,
  precioEnLista: number | null
): number {
  return precioEnLista ?? precioBase;
}

/** Cuantas filas siguen sin precio propio, para el chip "Precio no definido". */
export function contarSinPrecio(filas: Pick<FilaLista, "precio">[]): number {
  return filas.filter((f) => f.precio === null).length;
}

export type ResultadoPorcentaje =
  | { ok: true; precio: number }
  | { ok: false; error: string };

/**
 * Aplica un porcentaje SOBRE EL PRECIO BASE.
 *
 * ⚠️ Sobre el BASE, no sobre el precio que ya tenga la lista. Es lo que dice la
 * propia interfaz ("sobre los precios base de los N productos seleccionados") y
 * lo que evita que aplicar 20 % dos veces componga: quien corrige un descuento
 * espera volver al mismo sitio, no acumular.
 */
export function aplicarPorcentaje(
  precioBase: number,
  porcentaje: number,
  direccion: Direccion,
  redondearAEnteros = false
): ResultadoPorcentaje {
  if (!Number.isFinite(porcentaje)) {
    return { ok: false, error: "Escribe un porcentaje válido" };
  }
  if (porcentaje < 0) {
    return { ok: false, error: "El porcentaje no puede ser negativo" };
  }
  if (direccion === "disminuir" && porcentaje > 100) {
    return {
      ok: false,
      // Un 120 % de descuento dejaria el precio en negativo y el punto de venta
      // cobraria al reves.
      error: "Un descuento no puede pasar del 100%",
    };
  }

  const factor =
    direccion === "aumentar" ? 1 + porcentaje / 100 : 1 - porcentaje / 100;
  const bruto = Number(precioBase) * factor;

  const precio = redondearAEnteros
    ? Math.round(bruto)
    : Math.round(bruto * 100) / 100;

  return { ok: true, precio };
}

/** Lo que se escribe a mano en la celda del precio de la lista. */
export function parsearPrecio(texto: string): ResultadoPorcentaje {
  const limpio = texto.trim();
  if (limpio === "") {
    return { ok: false, error: "Escribe un precio" };
  }
  const numero = Number(limpio);
  if (!Number.isFinite(numero)) {
    return { ok: false, error: "Escribe un precio válido" };
  }
  if (numero < 0) {
    return { ok: false, error: "El precio no puede ser negativo" };
  }
  return { ok: true, precio: Math.round(numero * 100) / 100 };
}

// ============================================================
// Filas seleccionables: cada producto y, debajo, cada variante
// ============================================================

export interface ProductoBase {
  id: string;
  nombre: string;
  precio_venta: number;
  categoria: string | null;
}

export interface VarianteBase {
  id: string;
  producto_id: string;
  talla: string | null;
  color: string | null;
  precio_venta: number;
}

export interface FilaSeleccionable {
  clave: string;
  producto_id: string;
  variante_id: string | null;
  nombre: string;
  /** "M / ROJO" cuando es variante; `null` para el producto suelto. */
  sufijo: string | null;
  categoria: string | null;
  precio_base: number;
  /** Para el buscador: nombre del padre + talla + color. */
  busqueda: string;
}

/**
 * Aplana el catalogo en filas seleccionables.
 *
 * Es hermana de `construirOpciones` en `purchase-order-items.ts`, que hace lo
 * mismo para las ordenes de compra; se mantienen separadas porque aquella
 * trabaja con el COSTO y esta con el PRECIO DE VENTA, y mezclarlas invitaria a
 * confundir los dos numeros justo donde mas duele.
 */
export function construirFilas(
  productos: ProductoBase[],
  variantes: VarianteBase[]
): FilaSeleccionable[] {
  const filas: FilaSeleccionable[] = [];

  for (const p of productos) {
    filas.push({
      clave: claveFila(p.id, null),
      producto_id: p.id,
      variante_id: null,
      nombre: p.nombre,
      sufijo: null,
      categoria: p.categoria,
      precio_base: Number(p.precio_venta) || 0,
      busqueda: `${p.nombre} ${p.categoria ?? ""}`,
    });

    for (const v of variantes.filter((v) => v.producto_id === p.id)) {
      const sufijo = [v.talla, v.color].filter(Boolean).join(" / ") || "Variante";
      filas.push({
        clave: claveFila(p.id, v.id),
        producto_id: p.id,
        variante_id: v.id,
        nombre: p.nombre,
        sufijo,
        categoria: p.categoria,
        // La variante tiene su PROPIO precio. Con 0 hereda el del padre, que es
        // la misma regla que aplica el punto de venta (`variantPrice`).
        precio_base:
          Number(v.precio_venta) > 0
            ? Number(v.precio_venta)
            : Number(p.precio_venta) || 0,
        busqueda: `${p.nombre} ${sufijo} ${p.categoria ?? ""}`,
      });
    }
  }

  return filas;
}
