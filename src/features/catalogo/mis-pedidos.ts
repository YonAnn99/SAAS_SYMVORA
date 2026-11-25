/**
 * «Mis pedidos» del catálogo público: el navegador del cliente recuerda los pedidos que hizo (o que abrió desde el
 * enlace que le mandó el negocio) para que pueda volver a su seguimiento sin tener cuenta.
 *
 * Solo guarda lo mínimo: el código de seguimiento (que ES el acceso al pedido), el folio y la fecha. Nunca teléfono,
 * dirección ni notas. Por negocio (`symvora-pedidos:<slug>`), con tope de 20 y sin duplicados. Todo envuelto en
 * try/catch: en navegación privada o con el almacenamiento lleno simplemente no recuerda nada.
 */

export interface PedidoGuardado {
  codigo: string;
  /** Número de pedido del negocio, o null si no se conoce. */
  folio: number | null;
  /** ISO 8601. */
  creado: string;
}

export const MAX_PEDIDOS_GUARDADOS = 20;

/** Los 12 caracteres del código de seguimiento (sin 0, 1, I, L, O, U). Igual que `pedido_publico`. */
const CODIGO = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$/;

type Lectura = Pick<Storage, "getItem">;
type Escritura = Pick<Storage, "getItem" | "setItem">;

export function clavePedidosGuardados(slug: string): string {
  return `symvora-pedidos:${slug}`;
}

function normalizar(crudo: unknown): PedidoGuardado | null {
  if (!crudo || typeof crudo !== "object") return null;
  const p = crudo as Record<string, unknown>;
  const codigo = typeof p.codigo === "string" ? p.codigo.trim().toUpperCase() : "";
  if (!CODIGO.test(codigo)) return null;
  const folio = typeof p.folio === "number" && Number.isInteger(p.folio) && p.folio > 0 ? p.folio : null;
  const fecha = typeof p.creado === "string" ? new Date(p.creado) : null;
  const creado = fecha && !Number.isNaN(fecha.getTime()) ? fecha.toISOString() : new Date(0).toISOString();
  return { codigo, folio, creado };
}

/** Lo guardado para un negocio, lo más reciente primero. Ignora cualquier cosa que no sea un pedido válido. */
export function leerPedidosGuardados(almacen: Lectura | null, slug: string): PedidoGuardado[] {
  if (!almacen || !slug) return [];
  try {
    const crudo = almacen.getItem(clavePedidosGuardados(slug));
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(lista)) return [];
    const vistos = new Set<string>();
    return lista
      .map(normalizar)
      .filter((p): p is PedidoGuardado => p !== null && !vistos.has(p.codigo) && !!vistos.add(p.codigo))
      .sort((a, b) => b.creado.localeCompare(a.creado))
      .slice(0, MAX_PEDIDOS_GUARDADOS);
  } catch {
    return [];
  }
}

/** Agrega (o actualiza) un pedido y devuelve la lista resultante. Si no se puede guardar, devuelve lo que había. */
export function guardarPedido(almacen: Escritura | null, slug: string, pedido: PedidoGuardado): PedidoGuardado[] {
  const nuevo = normalizar(pedido);
  const actuales = leerPedidosGuardados(almacen, slug);
  if (!almacen || !slug || !nuevo) return actuales;
  // Si ya estaba, se conserva su fecha original y se completa el folio si faltaba.
  const previo = actuales.find((p) => p.codigo === nuevo.codigo);
  const fusionado: PedidoGuardado = previo
    ? { codigo: previo.codigo, folio: nuevo.folio ?? previo.folio, creado: previo.creado }
    : nuevo;
  const lista = [fusionado, ...actuales.filter((p) => p.codigo !== nuevo.codigo)]
    .sort((a, b) => b.creado.localeCompare(a.creado))
    .slice(0, MAX_PEDIDOS_GUARDADOS);
  try {
    almacen.setItem(clavePedidosGuardados(slug), JSON.stringify(lista));
    return lista;
  } catch {
    return actuales;
  }
}

/** El almacenamiento del navegador, o null si no hay o está bloqueado. */
export function almacenDelNavegador(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
