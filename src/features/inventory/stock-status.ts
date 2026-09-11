/**
 * Estado de stock de un producto y ordenación del catálogo.
 *
 * `stockStatus()` es la **fuente única**: la consumen tanto la etiqueta de la
 * tabla como el filtro del diálogo. Antes la etiqueta usaba su propia regla
 * (`stock_actual <= stock_minimo`), que metía a los agotados dentro de "stock
 * bajo": un producto con 0 existencias se mostraba como "Stock bajo" pero
 * filtraría como "Agotado". Con una sola función no pueden divergir.
 *
 * Los tres grupos son **mutuamente excluyentes y cubren todo**: cada producto
 * cae en exactamente uno, así los conteos suman el total.
 */

export type StockStatus = "agotado" | "bajo" | "ok";

interface StockFields {
  stock_actual: number;
  stock_minimo: number;
}

export function stockStatus(product: StockFields): StockStatus {
  const actual = Number(product.stock_actual);
  const minimo = Number(product.stock_minimo);

  if (actual <= 0) return "agotado";
  // Con `stock_minimo` en 0 (el valor por defecto) esta rama nunca se cumple,
  // y todo lo que tenga existencias sale "ok". Es lo correcto: sin mínimo
  // definido no hay forma de saber qué es "poco".
  if (actual <= minimo) return "bajo";
  return "ok";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  agotado: "Stock agotado",
  bajo: "Stock bajo",
  ok: "Con stock",
};

// ============================================================
// Ordenación
// ============================================================

export type SortOption =
  | "recientes"
  | "antiguos"
  | "modificados"
  | "stockAsc"
  | "stockDesc"
  | "precioAsc"
  | "precioDesc"
  | "nombreAsc"
  | "nombreDesc";

export const SORT_LABELS: Record<SortOption, string> = {
  recientes: "Últimos creados",
  antiguos: "Creados primero",
  modificados: "Últimos modificados",
  stockAsc: "Menor cantidad de stock",
  stockDesc: "Mayor cantidad de stock",
  precioAsc: "Menor precio",
  precioDesc: "Mayor precio",
  nombreAsc: "Título A-Z",
  nombreDesc: "Título Z-A",
};

export const DEFAULT_SORT: SortOption = "recientes";

interface SortableProduct extends StockFields {
  nombre: string;
  precio_venta: number;
  creado_en?: string | null;
  actualizado_en?: string | null;
}

function time(value: string | null | undefined): number {
  // Sin fecha se manda al final en los órdenes descendentes, en vez de
  // producir NaN y un orden impredecible.
  return value ? new Date(value).getTime() : 0;
}

/**
 * Devuelve una copia ordenada. No muta el array recibido: el llamador suele
 * pasar el resultado de un `useMemo` sobre el estado.
 *
 * Todos los criterios desempatan por nombre, para que el orden sea estable y
 * la lista no "salte" al recargar cuando hay valores repetidos.
 */
export function sortProducts<T extends SortableProduct>(
  products: T[],
  sort: SortOption
): T[] {
  const byName = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");

  const comparators: Record<SortOption, (a: T, b: T) => number> = {
    recientes: (a, b) => time(b.creado_en) - time(a.creado_en) || byName(a, b),
    antiguos: (a, b) => time(a.creado_en) - time(b.creado_en) || byName(a, b),
    modificados: (a, b) =>
      time(b.actualizado_en) - time(a.actualizado_en) || byName(a, b),
    stockAsc: (a, b) =>
      Number(a.stock_actual) - Number(b.stock_actual) || byName(a, b),
    stockDesc: (a, b) =>
      Number(b.stock_actual) - Number(a.stock_actual) || byName(a, b),
    precioAsc: (a, b) =>
      Number(a.precio_venta) - Number(b.precio_venta) || byName(a, b),
    precioDesc: (a, b) =>
      Number(b.precio_venta) - Number(a.precio_venta) || byName(a, b),
    nombreAsc: byName,
    nombreDesc: (a, b) => byName(b, a),
  };

  return [...products].sort(comparators[sort]);
}

// ============================================================
// Filtros
// ============================================================

export interface ProductFilters {
  /** Grupos de stock marcados. Vacío = sin filtrar por stock. */
  stock: StockStatus[];
  /** `null` = todas. `"__sin__"` = solo los que no tienen categoría. */
  categoria: string | null;
  sort: SortOption;
}

export const SIN_CATEGORIA = "__sin__";

export const EMPTY_FILTERS: ProductFilters = {
  stock: [],
  categoria: null,
  sort: DEFAULT_SORT,
};

/** Cuántos filtros hay activos, para el contador del botón. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    (filters.stock.length > 0 ? 1 : 0) +
    (filters.categoria ? 1 : 0) +
    (filters.sort !== DEFAULT_SORT ? 1 : 0)
  );
}

interface FilterableProduct extends SortableProduct {
  categoria?: string | null;
}

/**
 * Aplica filtros y orden. El texto de búsqueda se filtra aparte, ANTES, para
 * que ambas cosas se combinen en cadena en vez de sustituirse.
 */
export function applyProductFilters<T extends FilterableProduct>(
  products: T[],
  filters: ProductFilters
): T[] {
  const filtered = products.filter((p) => {
    if (filters.stock.length > 0 && !filters.stock.includes(stockStatus(p))) {
      return false;
    }
    if (filters.categoria === SIN_CATEGORIA) {
      return !p.categoria;
    }
    if (filters.categoria && p.categoria !== filters.categoria) {
      return false;
    }
    return true;
  });

  return sortProducts(filtered, filters.sort);
}

/** Conteo por grupo, para mostrarlo en cada chip. */
export function countByStatus<T extends StockFields>(
  products: T[]
): Record<StockStatus, number> {
  const counts: Record<StockStatus, number> = { agotado: 0, bajo: 0, ok: 0 };
  for (const p of products) counts[stockStatus(p)]++;
  return counts;
}
