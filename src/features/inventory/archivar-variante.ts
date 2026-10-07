/**
 * Archivar una variante (migracion 110).
 *
 * Si es la ULTIMA activa de su producto, no se archiva sola: un producto con
 * variantes y ninguna activa se quedaria en el catalogo y en el POS como
 * producto general (precio y stock 0). En ese caso se archiva el producto
 * completo; sus variantes vuelven con el al restaurarlo.
 */

interface VarianteDeProducto {
  id: string;
  producto_id: string;
  archivado_en?: string | null;
}

/** `variantes`: las que se conocen del negocio (pueden venir de varios productos). */
export function esUltimaVarianteActiva(
  variante: VarianteDeProducto,
  variantes: readonly VarianteDeProducto[]
): boolean {
  return !variantes.some(
    (v) => v.producto_id === variante.producto_id && v.id !== variante.id && !v.archivado_en
  );
}

/** Lo que el catalogo le pasa al hook para la ultima variante de un producto. */
export interface ProductoDeLaVariante {
  nombre: string;
  /** Archiva el producto completo, SIN volver a confirmar. */
  archivar: () => Promise<boolean>;
}
