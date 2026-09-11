/**
 * Catálogo de módulos del sistema y el permiso que exige cada uno.
 *
 * Fuente única para las cuatro capas que deciden quién ve y quién puede qué:
 * el sidebar, el middleware, el diálogo de permisos de `/users` y la
 * validación del endpoint que los guarda. Tenerlo en un solo sitio es lo que
 * evita que el menú diga una cosa y la base de datos otra.
 *
 * REGLA IMPORTANTE: `grantable: false` **no es solo para ocultar el switch**.
 * El endpoint lo valida en el servidor y la migración 055 lo respalda con un
 * CHECK en la tabla, de modo que ni saltándose la interfaz se puede conceder.
 * En este proyecto la barrera cosmética ya falló cuatro veces (bugs #1, #27,
 * #33, #34): aquí hay tres barreras independientes a propósito.
 */

export interface ModuleDefinition {
  /** Clave estable; se usa como id en la UI. */
  key: string;
  /** Etiqueta para el diálogo de permisos. */
  label: string;
  /** Para qué sirve, en una línea, en el idioma del dueño del negocio. */
  description: string;
  /** Ruta principal. `null` si no es un módulo navegable. */
  href: string | null;
  /**
   * Permiso que exige. `null` = abierto a cualquier miembro del negocio
   * (Dashboard, POS, catálogo de productos).
   */
  permission: string | null;
  /** ¿El SUPER_ADMIN puede concederlo o quitarlo por usuario? */
  grantable: boolean;
  /** Por qué NO es concedible. Solo para los que no lo son. */
  notGrantableReason?: string;
}

export const MODULES: ModuleDefinition[] = [
  {
    key: "pos",
    label: "Punto de venta",
    description: "Cobrar y registrar ventas",
    href: "/pos",
    permission: "sales.create",
    grantable: true,
  },
  {
    // El catálogo de /products está abierto a todo miembro: es lo que el
    // cajero consulta para vender. NO confundir con el módulo "inventory",
    // que son las pestañas de variantes/lotes/ajustes dentro de esa misma
    // página. Mapear /products a inventory.manage dejaría a los cajeros sin
    // catálogo, que es justo lo contrario de lo que se quiere.
    key: "products",
    label: "Catálogo de productos",
    description: "Consultar el catálogo (abierto a todo el equipo)",
    href: "/products",
    permission: null,
    grantable: false,
    notGrantableReason: "Todo el equipo necesita consultar el catálogo.",
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Crear y editar productos, variantes, lotes y ajustes",
    href: null,
    permission: "inventory.manage",
    grantable: true,
  },
  {
    key: "purchases",
    label: "Compras",
    description: "Compras a proveedores",
    href: "/purchases",
    permission: "purchases.manage",
    grantable: true,
  },
  {
    // Ruta propia: `permissionForPath` compara por prefijo y "/purchase-orders"
    // NO coincide con "/purchases", así que necesita su propia entrada o la
    // ruta quedaría sin proteger.
    key: "purchaseOrders",
    label: "Órdenes de compra",
    description: "Pedidos a proveedores y su recepción",
    href: "/purchase-orders",
    permission: "purchases.manage",
    grantable: true,
  },
  {
    key: "facturas",
    label: "Facturación CFDI",
    description: "Timbrado de comprobantes (módulo oculto por el momento)",
    href: "/facturas",
    permission: "billing.create",
    grantable: true,
  },
  {
    key: "finances",
    label: "Finanzas",
    description: "Caja, movimientos de dinero y cortes",
    href: "/finances",
    permission: "finances.manage",
    grantable: true,
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Ventas por periodo, productos y ganancias",
    href: "/reports",
    permission: "sales.view_reports",
    grantable: true,
  },
  {
    key: "settings",
    label: "Configuración",
    description: "Datos del negocio y módulos activos",
    href: "/settings",
    permission: "org.manage_settings",
    grantable: true,
  },
  {
    key: "salesVoid",
    label: "Cancelar ventas",
    description: "Anular una venta ya registrada",
    href: null,
    permission: "sales.void",
    grantable: true,
  },
  // --- No concedibles: reparten poder ---
  {
    key: "users",
    label: "Usuarios",
    description: "Invitar, eliminar y cambiar roles",
    href: "/users",
    permission: "org.manage_members",
    grantable: false,
    notGrantableReason:
      "Quien administra usuarios puede ascender a otros y a sí mismo. Solo el dueño reparte poder.",
  },
  {
    key: "billing",
    label: "Facturación y suscripción",
    description: "Plan, pagos y cancelación de la suscripción",
    href: "/billing",
    permission: "subscription.manage",
    grantable: false,
    notGrantableReason:
      "Permite cambiar el plan y cancelar la suscripción del negocio.",
  },
];

/** Los que el SUPER_ADMIN puede activar o desactivar por usuario. */
export const GRANTABLE_MODULES = MODULES.filter((m) => m.grantable);

/**
 * Permisos concedibles. Debe coincidir con el CHECK de la migración 055 —
 * si se añade uno aquí sin añadirlo allí, la base de datos lo rechazará.
 */
export const GRANTABLE_PERMISSIONS = new Set(
  GRANTABLE_MODULES.map((m) => m.permission).filter((p): p is string => p !== null)
);

/** Permiso que protege una ruta, o `null` si está abierta a todo miembro. */
export function permissionForPath(path: string): string | null {
  // Se recorre de más específico a menos para que `/settings/payments` no
  // coincida antes con `/settings` si algún día se separan.
  const match = [...MODULES]
    .filter((m) => m.href)
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))
    .find((m) => path === m.href || path.startsWith(`${m.href}/`));

  return match?.permission ?? null;
}
