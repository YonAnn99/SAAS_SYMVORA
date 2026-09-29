/**
 * Descarga de la informacion comercial de una cuenta vencida o cancelada.
 *
 * Los Terminos (seccion 6) dan 30 dias naturales para exportar la informacion
 * tras cancelar o vencer el acceso. Una cuenta vencida solo puede entrar a
 * /billing (el middleware la redirige ahi), asi que la descarga vive en esa
 * pagina. La RLS no depende de la suscripcion: el dueño sigue leyendo sus
 * propios datos con el cliente del navegador.
 *
 * Cada conjunto sale como un CSV (abre en Excel) con `exportToCSV`.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { exportToCSV } from "@/lib/export/csv";

/** Estados en los que se ofrece la descarga. */
export const ESTADOS_CON_DESCARGA = ["expired", "past_due", "canceled"] as const;

export const DIAS_GRACIA_EXPORTACION = 30;

export function ofreceDescarga(estado: string | null | undefined): boolean {
  return (ESTADOS_CON_DESCARGA as readonly string[]).includes(estado ?? "");
}

/**
 * Fecha limite del periodo de gracia: 30 dias despues de que termino el
 * acceso (fin del periodo pagado o, si nunca pago, fin de la prueba).
 */
export function limiteDescarga(sub: {
  current_period_end: string | null;
  trial_end: string | null;
}): Date | null {
  const base = sub.current_period_end ?? sub.trial_end;
  if (!base) return null;
  const fecha = new Date(base);
  if (Number.isNaN(fecha.getTime())) return null;
  fecha.setDate(fecha.getDate() + DIAS_GRACIA_EXPORTACION);
  return fecha;
}

const TAM_PAGINA = 1000;

type Fila = Record<string, unknown>;
type Columna = { header: string; accessor: (fila: Fila) => string | number };

/** El nombre de una relacion embebida (`clientes(nombre)`), o vacio. */
function nombreDe(valor: unknown): string {
  if (valor && typeof valor === "object" && "nombre" in valor) {
    return String((valor as { nombre: unknown }).nombre ?? "");
  }
  return "";
}

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numero = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const fecha = (v: unknown) => (v ? String(v).slice(0, 19).replace("T", " ") : "");

interface Conjunto {
  clave: string;
  etiqueta: string;
  archivo: string;
  tabla: string;
  select: string;
  /** Columna para filtrar por negocio (con embebido `!inner` cuando no es propia). */
  filtroTenant: string;
  columnas: Columna[];
}

export const CONJUNTOS: Conjunto[] = [
  {
    clave: "productos",
    etiqueta: "Productos",
    archivo: "productos",
    tabla: "productos",
    select:
      "id, nombre, sku, codigo_barras, categoria, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo, es_servicio",
    filtroTenant: "tenant_id",
    columnas: [
      { header: "Nombre", accessor: (f) => texto(f.nombre) },
      { header: "SKU", accessor: (f) => texto(f.sku) },
      { header: "Código de barras", accessor: (f) => texto(f.codigo_barras) },
      { header: "Categoría", accessor: (f) => texto(f.categoria) },
      { header: "Unidad", accessor: (f) => texto(f.unidad_medida) },
      { header: "Precio de venta", accessor: (f) => numero(f.precio_venta) },
      { header: "Costo", accessor: (f) => numero(f.costo_compra) },
      { header: "Stock actual", accessor: (f) => numero(f.stock_actual) },
      { header: "Stock mínimo", accessor: (f) => numero(f.stock_minimo) },
      { header: "Servicio", accessor: (f) => (f.es_servicio ? "Sí" : "No") },
    ],
  },
  {
    clave: "clientes",
    etiqueta: "Clientes",
    archivo: "clientes",
    tabla: "clientes",
    select:
      "id, nombre, email, telefono, direccion, rfc, razon_social, codigo_postal, limite_credito, saldo_pendiente",
    filtroTenant: "tenant_id",
    columnas: [
      { header: "Nombre", accessor: (f) => texto(f.nombre) },
      { header: "Email", accessor: (f) => texto(f.email) },
      { header: "Teléfono", accessor: (f) => texto(f.telefono) },
      { header: "Dirección", accessor: (f) => texto(f.direccion) },
      { header: "RFC", accessor: (f) => texto(f.rfc) },
      { header: "Razón social", accessor: (f) => texto(f.razon_social) },
      { header: "Código postal", accessor: (f) => texto(f.codigo_postal) },
      { header: "Límite de crédito", accessor: (f) => numero(f.limite_credito) },
      { header: "Saldo pendiente", accessor: (f) => numero(f.saldo_pendiente) },
    ],
  },
  {
    clave: "proveedores",
    etiqueta: "Proveedores",
    archivo: "proveedores",
    tabla: "proveedores",
    select: "id, nombre, contact_name, email, telefono, direccion, condiciones_comerciales",
    filtroTenant: "tenant_id",
    columnas: [
      { header: "Nombre", accessor: (f) => texto(f.nombre) },
      { header: "Contacto", accessor: (f) => texto(f.contact_name) },
      { header: "Email", accessor: (f) => texto(f.email) },
      { header: "Teléfono", accessor: (f) => texto(f.telefono) },
      { header: "Dirección", accessor: (f) => texto(f.direccion) },
      { header: "Condiciones", accessor: (f) => texto(f.condiciones_comerciales) },
    ],
  },
  {
    clave: "ventas",
    etiqueta: "Ventas",
    archivo: "ventas",
    tabla: "ventas",
    select:
      "id, fecha_venta, subtotal, descuento, impuesto, total, metodo_pago, estado, notas, clientes(nombre)",
    filtroTenant: "tenant_id",
    columnas: [
      { header: "ID venta", accessor: (f) => texto(f.id) },
      { header: "Fecha", accessor: (f) => fecha(f.fecha_venta) },
      { header: "Cliente", accessor: (f) => nombreDe(f.clientes) },
      { header: "Subtotal", accessor: (f) => numero(f.subtotal) },
      { header: "Descuento", accessor: (f) => numero(f.descuento) },
      { header: "Impuesto", accessor: (f) => numero(f.impuesto) },
      { header: "Total", accessor: (f) => numero(f.total) },
      { header: "Método de pago", accessor: (f) => texto(f.metodo_pago) },
      { header: "Estado", accessor: (f) => texto(f.estado) },
      { header: "Notas", accessor: (f) => texto(f.notas) },
    ],
  },
  {
    clave: "detalle_ventas",
    etiqueta: "Detalle de ventas",
    archivo: "detalle_ventas",
    tabla: "detalle_ventas",
    select:
      "id, venta_id, cantidad, precio_unitario, descuento, subtotal, productos(nombre), ventas!inner(fecha_venta, tenant_id)",
    filtroTenant: "ventas.tenant_id",
    columnas: [
      { header: "ID venta", accessor: (f) => texto(f.venta_id) },
      {
        header: "Fecha",
        accessor: (f) =>
          fecha((f.ventas as { fecha_venta?: unknown } | null)?.fecha_venta),
      },
      { header: "Producto", accessor: (f) => nombreDe(f.productos) },
      { header: "Cantidad", accessor: (f) => numero(f.cantidad) },
      { header: "Precio unitario", accessor: (f) => numero(f.precio_unitario) },
      { header: "Descuento", accessor: (f) => numero(f.descuento) },
      { header: "Subtotal", accessor: (f) => numero(f.subtotal) },
    ],
  },
  {
    clave: "compras",
    etiqueta: "Compras",
    archivo: "compras",
    tabla: "compras",
    select:
      "id, fecha_compra, numero_factura, subtotal, impuesto, total, estado, notas, proveedores(nombre)",
    filtroTenant: "tenant_id",
    columnas: [
      { header: "Fecha", accessor: (f) => fecha(f.fecha_compra) },
      { header: "Proveedor", accessor: (f) => nombreDe(f.proveedores) },
      { header: "Factura", accessor: (f) => texto(f.numero_factura) },
      { header: "Subtotal", accessor: (f) => numero(f.subtotal) },
      { header: "Impuesto", accessor: (f) => numero(f.impuesto) },
      { header: "Total", accessor: (f) => numero(f.total) },
      { header: "Estado", accessor: (f) => texto(f.estado) },
      { header: "Notas", accessor: (f) => texto(f.notas) },
    ],
  },
];

/**
 * Trae TODAS las filas de un conjunto, de 1000 en 1000 (PostgREST corta cada
 * respuesta en 1000). Ordena por id para que las paginas no se traslapen.
 */
async function traerTodo(conjunto: Conjunto, tenantId: string): Promise<Fila[]> {
  const supabase = createSupabaseBrowserClient();
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await supabase
      .from(conjunto.tabla)
      .select(conjunto.select)
      .eq(conjunto.filtroTenant, tenantId)
      .order("id")
      .range(desde, desde + TAM_PAGINA - 1);
    if (error) throw error;
    const pagina = (data ?? []) as unknown as Fila[];
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA) return filas;
  }
}

/** Descarga un conjunto como CSV. Devuelve cuantas filas exporto. */
export async function descargarConjunto(
  conjunto: Conjunto,
  tenantId: string
): Promise<number> {
  const filas = await traerTodo(conjunto, tenantId);
  exportToCSV(filas, conjunto.columnas, conjunto.archivo);
  return filas.length;
}
