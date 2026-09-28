/**
 * Las cifras de "Compras del periodo" en Reportes.
 *
 * Es una vista de FLUJO (en qué se va el dinero), aparte de la ganancia: la
 * ganancia ya descuenta el costo de lo VENDIDO, y restarle además las compras
 * contaría dos veces la misma mercancía. Por eso aquí solo se informa.
 */

export interface CompraParaResumen {
  id: string;
  total: number | string;
  estado: string;
  proveedor: { nombre: string } | null;
}

export interface PagoCajaParaResumen {
  compra_id: string | null;
  monto: number | string;
}

export interface OrdenAbiertaParaResumen {
  subtotal: number | string;
  impuesto: number | string;
  detalle: {
    cantidad_solicitada: number | string;
    cantidad_recibida: number | string;
    costo_unitario: number | string;
  }[];
}

export interface ResumenCompras {
  totalComprado: number;
  numeroCompras: number;
  /** De lo comprado, lo que salió del efectivo de alguna caja. */
  pagadoConCaja: number;
  /** Ventas del periodo menos compras del periodo. */
  diferencia: number;
  topProveedores: { nombre: string; total: number; compras: number }[];
  /** Lo pedido que todavía no llega (con su IVA), en órdenes abiertas hoy. */
  pendientePorRecibir: number;
  ordenesAbiertas: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function resumenCompras(params: {
  compras: CompraParaResumen[];
  pagosCaja: PagoCajaParaResumen[];
  ordenesAbiertas: OrdenAbiertaParaResumen[];
  totalVentas: number;
}): ResumenCompras {
  // Una compra cancelada no gastó nada: devolvió el stock (y, si se pagó con
  // caja abierta, el efectivo).
  const vigentes = params.compras.filter((c) => c.estado !== "CANCELADA");
  const ids = new Set(vigentes.map((c) => c.id));

  const totalComprado = redondear(
    vigentes.reduce((acc, c) => acc + Number(c.total), 0)
  );

  const pagadoConCaja = redondear(
    params.pagosCaja
      .filter((p) => p.compra_id && ids.has(p.compra_id))
      .reduce((acc, p) => acc + Number(p.monto), 0)
  );

  const porProveedor = new Map<string, { total: number; compras: number }>();
  for (const c of vigentes) {
    const nombre = c.proveedor?.nombre ?? "Sin proveedor";
    const actual = porProveedor.get(nombre) ?? { total: 0, compras: 0 };
    actual.total += Number(c.total);
    actual.compras += 1;
    porProveedor.set(nombre, actual);
  }
  const topProveedores = [...porProveedor.entries()]
    .map(([nombre, v]) => ({ nombre, total: redondear(v.total), compras: v.compras }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Lo que falta por llegar, con el IVA de cada orden (la tasa se deduce de lo
  // guardado, como en la recepción: impuesto / subtotal).
  const pendientePorRecibir = redondear(
    params.ordenesAbiertas.reduce((acc, o) => {
      const subtotal = Number(o.subtotal);
      const tasa = subtotal > 0 ? Number(o.impuesto) / subtotal : 0;
      const falta = o.detalle.reduce((s, d) => {
        const pendiente = Math.max(
          0,
          Number(d.cantidad_solicitada) - Number(d.cantidad_recibida)
        );
        return s + pendiente * Number(d.costo_unitario);
      }, 0);
      return acc + falta * (1 + tasa);
    }, 0)
  );

  return {
    totalComprado,
    numeroCompras: vigentes.length,
    pagadoConCaja,
    diferencia: redondear(params.totalVentas - totalComprado),
    topProveedores,
    pendientePorRecibir,
    ordenesAbiertas: params.ordenesAbiertas.length,
  };
}
