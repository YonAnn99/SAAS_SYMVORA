/**
 * Acciones de la busqueda rapida (Ctrl/Cmd+K): los botones del sistema que se
 * pueden encontrar escribiendo lo que se quiere hacer ("abrir caja", "corte",
 * "agregar producto"...). Al elegir una, se va al modulo con `?accion=<id>` y
 * la pagina abre la ventana de ese boton (`useAccionRapida`).
 *
 * Tambien trae sinonimos para los modulos del grupo Navegacion: quien teclea
 * "caja" espera encontrar Finanzas.
 *
 * Logica pura (sin iconos ni React) para poder probar la busqueda.
 */

import type { ClaveModulo } from "@/lib/modulos";

export interface AccionRapida {
  id: string;
  etiqueta: string;
  /** Sinonimos y terminos del giro. La etiqueta ya cuenta; no repetirla. */
  palabrasClave: string[];
  /** Ruta (con `?accion=` o una pestaña existente). */
  href: string;
  /** Permiso efectivo que exige, el mismo que el boton en su modulo. */
  permiso: string;
  /** Modulo de Configuracion del que depende (si esta apagado no se ofrece). */
  modulo?: ClaveModulo;
  /** Nombre del icono de lucide (lo resuelve el menu). */
  icono: IconoAccion;
}

export type IconoAccion =
  | "caja-abrir"
  | "caja-cerrar"
  | "movimiento"
  | "venta"
  | "producto"
  | "variante"
  | "lote"
  | "ajuste"
  | "importar"
  | "precios"
  | "compra"
  | "proveedor"
  | "orden"
  | "usuario"
  | "sucursal"
  | "modulos"
  | "terminal"
  | "suscripcion"
  | "sugerencia"
  | "impresora";

/** Parametro de la URL con el que la pagina sabe que ventana abrir. */
export const PARAM_ACCION = "accion";

const conAccion = (ruta: string, id: string) => `${ruta}?${PARAM_ACCION}=${id}`;

export const ACCIONES_RAPIDAS: AccionRapida[] = [
  {
    id: "abrir-caja",
    etiqueta: "Abrir caja",
    palabrasClave: ["apertura", "iniciar turno", "fondo inicial", "empezar dia"],
    href: conAccion("/finances", "abrir-caja"),
    permiso: "cash.manage",
    icono: "caja-abrir",
  },
  {
    id: "cerrar-caja",
    etiqueta: "Cerrar caja (corte)",
    palabrasClave: ["corte", "cierre", "arqueo", "terminar turno", "cuadrar caja"],
    href: conAccion("/finances", "cerrar-caja"),
    permiso: "cash.manage",
    icono: "caja-cerrar",
  },
  {
    id: "movimiento-caja",
    etiqueta: "Registrar depósito o retiro de caja",
    palabrasClave: ["movimiento", "retiro", "deposito", "gasto", "salida de efectivo", "entrada de efectivo"],
    href: conAccion("/finances", "movimiento-caja"),
    permiso: "cash.manage",
    icono: "movimiento",
  },
  {
    id: "nueva-venta",
    etiqueta: "Nueva venta",
    palabrasClave: ["vender", "cobrar", "punto de venta", "pos", "ticket"],
    href: "/pos",
    permiso: "sales.create",
    icono: "venta",
  },
  {
    id: "agregar-producto",
    etiqueta: "Agregar producto",
    palabrasClave: ["nuevo producto", "crear producto", "alta de producto", "articulo"],
    href: conAccion("/products", "agregar-producto"),
    permiso: "inventory.manage",
    icono: "producto",
  },
  {
    id: "agregar-variante",
    etiqueta: "Agregar variante de producto",
    palabrasClave: ["talla", "color", "presentacion", "producto variante"],
    href: conAccion("/products", "agregar-variante"),
    permiso: "inventory.manage",
    modulo: "permite_variantes",
    icono: "variante",
  },
  {
    id: "agregar-lote",
    etiqueta: "Agregar lote",
    palabrasClave: ["caducidad", "vencimiento", "fecha de caducidad"],
    href: conAccion("/products", "agregar-lote"),
    permiso: "inventory.manage",
    modulo: "permite_lotes_caducidad",
    icono: "lote",
  },
  {
    id: "nuevo-ajuste",
    etiqueta: "Nuevo ajuste de inventario",
    palabrasClave: ["merma", "conteo", "corregir existencias", "corregir stock", "inventario"],
    href: conAccion("/products", "nuevo-ajuste"),
    permiso: "inventory.manage",
    icono: "ajuste",
  },
  {
    id: "importar-catalogo",
    etiqueta: "Importar catálogo",
    palabrasClave: ["excel", "csv", "carga masiva", "subir productos"],
    href: conAccion("/products", "importar-catalogo"),
    permiso: "inventory.manage",
    icono: "importar",
  },
  {
    id: "listas-precios",
    etiqueta: "Listas de precios",
    palabrasClave: ["mayoreo", "precio especial", "liquidacion", "distribuidor"],
    href: "/products/price-lists",
    permiso: "inventory.manage",
    icono: "precios",
  },
  {
    id: "nueva-compra",
    etiqueta: "Nueva compra",
    palabrasClave: ["registrar compra", "factura de proveedor", "mercancia", "surtir"],
    href: conAccion("/purchases", "nueva-compra"),
    permiso: "purchases.manage",
    icono: "compra",
  },
  {
    id: "agregar-proveedor",
    etiqueta: "Agregar proveedor",
    palabrasClave: ["nuevo proveedor", "alta de proveedor"],
    href: conAccion("/purchases", "agregar-proveedor"),
    permiso: "purchases.manage",
    icono: "proveedor",
  },
  {
    id: "nueva-orden",
    etiqueta: "Nueva orden de compra",
    palabrasClave: ["pedido a proveedor", "pedir mercancia", "orden"],
    href: conAccion("/purchase-orders", "nueva-orden"),
    permiso: "purchases.manage",
    icono: "orden",
  },
  {
    id: "invitar-usuario",
    etiqueta: "Invitar usuario",
    palabrasClave: ["empleado", "cajero", "clave de acceso", "agregar usuario", "nuevo usuario"],
    href: conAccion("/users", "invitar-usuario"),
    // Invitar es solo del dueño (ORG_ADMIN ve Usuarios pero no invita).
    permiso: "org.manage_members_write",
    icono: "usuario",
  },
  {
    id: "alta-sucursal",
    etiqueta: "Dar de alta sucursal",
    palabrasClave: ["nueva sucursal", "nuevo local", "tienda", "abrir otro local"],
    href: conAccion("/branches", "alta-sucursal"),
    permiso: "org.manage_branches",
    icono: "sucursal",
  },
  {
    id: "modulos",
    etiqueta: "Activar o desactivar módulos",
    palabrasClave: ["configurar", "variantes", "lotes", "granel", "funciones"],
    href: "/settings?tab=modules",
    permiso: "org.manage_settings",
    icono: "modulos",
  },
  {
    id: "mercado-pago",
    etiqueta: "Configurar Mercado Pago Point",
    palabrasClave: ["terminal", "pago con tarjeta", "mercado pago"],
    href: "/settings?tab=payments",
    permiso: "org.manage_settings",
    icono: "terminal",
  },
  {
    id: "impresora",
    etiqueta: "Conectar impresora de tickets",
    palabrasClave: ["impresora", "ticket", "termica", "bluetooth", "imprimir"],
    href: "/settings?tab=printer",
    permiso: "org.manage_settings",
    icono: "impresora",
  },
  {
    id: "pagar-suscripcion",
    etiqueta: "Pagar suscripción",
    palabrasClave: ["plan", "mensualidad", "pago", "renovar", "reactivar"],
    href: "/billing",
    permiso: "subscription.manage",
    icono: "suscripcion",
  },
  {
    id: "enviar-sugerencia",
    etiqueta: "Enviar sugerencia",
    palabrasClave: ["reportar error", "idea", "comentario", "falla"],
    href: "/suggestions",
    // Sugerencias esta abierta a todo miembro: `permiso` vacio = sin filtro.
    permiso: "",
    icono: "sugerencia",
  },
];

/** Sinonimos de los modulos del menu, por su `href`. */
export const PALABRAS_CLAVE_MODULOS: Record<string, string[]> = {
  "/dashboard": ["inicio", "resumen", "panel", "indicadores"],
  "/pos": ["vender", "cobrar", "caja registradora", "ticket"],
  "/products": ["catalogo", "inventario", "existencias", "stock", "articulos"],
  "/customers": ["clientes", "credito", "fiado", "deudores"],
  "/finances": ["caja", "efectivo", "corte", "movimientos", "gastos"],
  "/reports": ["ventas", "estadisticas", "graficas", "utilidad", "ganancias"],
  "/purchases": ["proveedores", "mercancia", "gastos de compra"],
  "/purchase-orders": ["pedidos", "ordenes", "proveedor"],
  "/activity": ["bitacora", "historial", "actividad", "auditoria"],
  "/users": ["empleados", "equipo", "roles", "permisos"],
  "/branches": ["locales", "tiendas", "traspasos"],
  "/billing": ["plan", "pago", "mensualidad", "facturacion"],
  "/suggestions": ["ideas", "comentarios", "reportar"],
  "/settings": ["ajustes", "preferencias", "modulos", "logo", "ticket"],
};

/** Minusculas y sin acentos: "Sesión" y "sesion" son lo mismo al buscar. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtro de la busqueda (firma del `filter` de cmdk): 1 si coincide, 0 si no.
 * Cada palabra tecleada tiene que aparecer en la etiqueta o en alguna palabra
 * clave, en cualquier orden: "caja cerrar" encuentra "Cerrar caja".
 */
export function coincideBusqueda(
  valor: string,
  busqueda: string,
  palabrasClave: string[] = []
): number {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return 1;
  const texto = normalizar([valor, ...palabrasClave].join(" "));
  return palabras.every((p) => texto.includes(p)) ? 1 : 0;
}

/** Acciones que puede usar quien busca (permiso y modulos encendidos). */
export function accionesDisponibles(
  can: (permiso: string) => boolean,
  modulos: Partial<Record<ClaveModulo, boolean>>
): AccionRapida[] {
  return ACCIONES_RAPIDAS.filter(
    (a) => (!a.permiso || can(a.permiso)) && (!a.modulo || modulos[a.modulo])
  );
}
