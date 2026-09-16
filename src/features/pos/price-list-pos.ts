/**
 * Las listas de precios vistas desde el punto de venta.
 *
 * Este archivo es el ESPEJO EN CLIENTE de lo que hace el servidor en
 * `_crear_venta_desde_items` (migracion 068). Lo que se pinta en la pantalla y
 * lo que se imprime en el ticket sale de aqui; lo que se COBRA sale del
 * servidor. Si las dos reglas se separan, el cliente ve un precio y paga otro.
 *
 * Por eso vive aparte y con test: es la unica forma de fijar la regla en un
 * sitio del que la pantalla no pueda desviarse sin que salte algo.
 */

import { claveFila, precioEfectivo } from "@/features/inventory/price-list";

/** Renglon de `precios_lista` tal y como llega de la base. */
export interface RenglonLista {
  producto_id: string;
  variante_id: string | null;
  /** `null` = "No definido": esta en la lista pero sin precio propio. */
  precio: number | null;
}

/**
 * Precios de una lista indexados por fila.
 *
 * `undefined` (clave ausente) = el producto NO esta en la lista.
 * `null` (clave presente)     = esta, pero sin precio propio.
 * Son cosas distintas y las dos acaban cobrando el precio base, pero solo la
 * segunda cuenta como "producto de la lista" para el filtrado del catalogo.
 */
export type MapaLista = ReadonlyMap<string, number | null>;

export function construirMapaLista(renglones: RenglonLista[]): MapaLista {
  const mapa = new Map<string, number | null>();
  for (const r of renglones) {
    mapa.set(claveFila(r.producto_id, r.variante_id), r.precio);
  }
  return mapa;
}

/** ¿Esta fila pertenece a la lista? (aunque sea sin precio propio). */
export function estaEnLista(
  mapa: MapaLista | null,
  productoId: string,
  varianteId: string | null
): boolean {
  if (!mapa) return false;
  return mapa.has(claveFila(productoId, varianteId));
}

/**
 * El precio que se le muestra al cajero.
 *
 * Reproduce exactamente el `IF v_lista_id IS NOT NULL` del servidor:
 * un renglon con precio lo pisa; uno sin precio, y uno ausente, dejan el base.
 */
export function precioConLista(
  precioBase: number,
  mapa: MapaLista | null,
  productoId: string,
  varianteId: string | null
): number {
  if (!mapa) return precioBase;
  // `get` devuelve undefined si no esta y null si esta sin precio. Los dos
  // casos caen al base, pero hay que normalizarlos antes de `precioEfectivo`,
  // que distingue null de 0 y no sabe nada de undefined.
  const enLista = mapa.get(claveFila(productoId, varianteId)) ?? null;
  return precioEfectivo(precioBase, enLista);
}

export interface ProductoCatalogo {
  id: string;
}

export interface VarianteCatalogo {
  id: string;
  producto_id: string;
}

/**
 * Deja en la cuadricula solo los productos de la lista.
 *
 * Un producto se queda si el producto suelto esta en la lista O si lo esta
 * alguna de sus variantes: si el distribuidor tiene precio para la talla M,
 * el sueter tiene que seguir siendo visible para poder llegar a ella.
 */
export function filtrarCatalogoPorLista<T extends ProductoCatalogo>(
  productos: T[],
  variantesPorProducto: Record<string, VarianteCatalogo[]>,
  mapa: MapaLista | null
): T[] {
  if (!mapa) return productos;
  return productos.filter((p) => {
    if (estaEnLista(mapa, p.id, null)) return true;
    const variantes = variantesPorProducto[p.id] ?? [];
    return variantes.some((v) => estaEnLista(mapa, p.id, v.id));
  });
}
