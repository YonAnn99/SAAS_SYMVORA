/**
 * Filtro "Favoritos" del POS con corazones de producto (064) y de variante
 * (098). Puro, para probarlo sin el POS.
 *
 *   - Un producto entra si EL o alguna de SUS variantes es favorita.
 *   - En vista Desglosado, si el producto no es favorito, solo se muestran sus
 *     variantes favoritas (marcar "Talla M" no debe traer todas las tallas).
 */

interface ConId {
  id: string;
}

export function productoEnFavoritos(
  productoId: string,
  favoritos: ReadonlySet<string>,
  variantesFavoritas: ReadonlySet<string>,
  variantesDelProducto: readonly ConId[] = []
): boolean {
  return favoritos.has(productoId) || variantesDelProducto.some((v) => variantesFavoritas.has(v.id));
}

export function variantesVisiblesEnFavoritos<V extends ConId>(
  productoId: string,
  variantes: readonly V[],
  favoritos: ReadonlySet<string>,
  variantesFavoritas: ReadonlySet<string>
): V[] {
  if (favoritos.has(productoId)) return [...variantes];
  return variantes.filter((v) => variantesFavoritas.has(v.id));
}
