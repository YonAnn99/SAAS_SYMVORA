import { stockStatus, type StockStatus } from "./stock-status";

/**
 * Resumen de un producto con variantes, para la fila del "producto general"
 * (catalogo y lista del celular) y para los filtros de estado.
 *
 * Un producto con variantes puede ser solo un NOMBRE ("Coca Cola") con precio
 * y stock en 0: lo que se vende son sus variantes (600 ml, 2.5 L). Su propio
 * stock y el de sus variantes son independientes (vender una variante solo
 * descuenta la suya), asi que el total es la suma de ambos.
 */
export interface ProductoResumible {
  precio_venta: number;
  stock_actual: number;
  stock_minimo: number;
  es_servicio?: boolean;
}

export interface VarianteResumible {
  precio_venta: number;
  stock_actual: number;
  stock_minimo?: number | null;
}

export interface ResumenVariantes {
  tieneVariantes: boolean;
  /** Stock propio del producto (si tiene) + el de todas sus variantes. */
  stockTotal: number;
  precioMin: number;
  precioMax: number;
  estado: StockStatus;
}

/** Precio de venta de una variante: 0 = "usa el del producto" (como en el POS). */
export function precioDeVariante(v: VarianteResumible, producto: ProductoResumible): number {
  return Number(v.precio_venta) > 0 ? Number(v.precio_venta) : Number(producto.precio_venta);
}

export function resumenConVariantes(
  producto: ProductoResumible,
  variantes: readonly VarianteResumible[] | undefined
): ResumenVariantes {
  const lista = variantes ?? [];
  if (lista.length === 0) {
    const precio = Number(producto.precio_venta);
    return {
      tieneVariantes: false,
      stockTotal: Number(producto.stock_actual),
      precioMin: precio,
      precioMax: precio,
      estado: stockStatus(producto),
    };
  }

  const propio = producto.es_servicio ? 0 : Math.max(0, Number(producto.stock_actual));
  const stockTotal = propio + lista.reduce((s, v) => s + Math.max(0, Number(v.stock_actual)), 0);
  const precios = lista.map((v) => precioDeVariante(v, producto));

  let estado: StockStatus;
  if (stockTotal <= 0) {
    estado = "agotado";
  } else if (
    // Alguna talla o presentacion agotada, o en su minimo (migracion 103):
    // hay que resurtir aunque el total se vea bien.
    lista.some((v) => {
      const actual = Number(v.stock_actual);
      return actual <= 0 || actual <= Number(v.stock_minimo ?? 0);
    })
  ) {
    estado = "bajo";
  } else {
    estado = "ok";
  }

  return {
    tieneVariantes: true,
    stockTotal,
    precioMin: Math.min(...precios),
    precioMax: Math.max(...precios),
    estado,
  };
}

/** "$18.00" o "$18.00 – $32.00". */
export function rangoDePrecio(r: Pick<ResumenVariantes, "precioMin" | "precioMax">): string {
  const min = `$${r.precioMin.toFixed(2)}`;
  return r.precioMin === r.precioMax ? min : `${min} – $${r.precioMax.toFixed(2)}`;
}
