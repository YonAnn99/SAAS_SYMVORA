/**
 * Los filtros del catalogo como etiquetas del Multi Select (barra de celular):
 *
 *   stock:<estado>   filters.stock        (varios)
 *   sinMinimo        filters.sinMinimo
 *   favoritos        filters.soloFavoritos
 *   cat:<nombre>     filters.categoria    (UNA: elegir otra reemplaza)
 *
 * Es el mismo `ProductFilters` que usan los chips y el dialogo de Filtros, asi
 * que las tres vistas quedan sincronizadas. El orden (`sort`) no es etiqueta:
 * se queda en el dialogo.
 */

import type { ProductFilters, StockStatus } from "./stock-status";

const ESTADOS: StockStatus[] = ["ok", "bajo", "agotado", "servicio"];

export const ETIQUETA_SIN_MINIMO = "sinMinimo";
export const ETIQUETA_FAVORITOS = "favoritos";
export const etiquetaStock = (estado: StockStatus) => `stock:${estado}`;
export const etiquetaCategoria = (categoria: string) => `cat:${categoria}`;

export function filtrosAEtiquetas(filtros: ProductFilters): string[] {
  const etiquetas = filtros.stock.map(etiquetaStock);
  if (filtros.sinMinimo) etiquetas.push(ETIQUETA_SIN_MINIMO);
  if (filtros.soloFavoritos) etiquetas.push(ETIQUETA_FAVORITOS);
  if (filtros.categoria !== null) etiquetas.push(etiquetaCategoria(filtros.categoria));
  return etiquetas;
}

/**
 * Las etiquetas de vuelta a filtros. `anteriores` es el valor previo: si hay
 * dos categorias, gana la recien elegida (la que no estaba antes).
 */
export function etiquetasAFiltros(
  etiquetas: string[],
  filtros: ProductFilters,
  anteriores: string[] = filtrosAEtiquetas(filtros)
): ProductFilters {
  const stock = ESTADOS.filter((e) => etiquetas.includes(etiquetaStock(e)));

  const categorias = etiquetas.filter((e) => e.startsWith("cat:"));
  const nueva = categorias.find((c) => !anteriores.includes(c));
  const elegida = nueva ?? categorias.at(-1);

  return {
    ...filtros,
    stock,
    sinMinimo: etiquetas.includes(ETIQUETA_SIN_MINIMO),
    soloFavoritos: etiquetas.includes(ETIQUETA_FAVORITOS),
    categoria: elegida ? elegida.slice("cat:".length) : null,
  };
}
