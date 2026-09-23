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
  /**
   * Rutas que cubre este módulo. Vacío si no es navegable.
   *
   * Es una LISTA y no una ruta única a propósito: un módulo puede abarcar
   * varias pantallas que comparten permiso (Compras y Órdenes de compra).
   * Modelarlas como módulos separados creaba dos switches que en secreto
   * controlaban el mismo permiso, y el diálogo lo mandaba duplicado -> error
   * 500 por la restricción UNIQUE de user_permission_overrides.
   */
  paths: string[];
  /**
   * Permiso que exige. `null` = abierto a cualquier miembro del negocio
   * (catálogo de productos, clientes, sugerencias).
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
    paths: ["/pos"],
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
    paths: ["/products"],
    permission: null,
    grantable: false,
    notGrantableReason: "Todo el equipo necesita consultar el catálogo.",
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Crear y editar productos, variantes, lotes y ajustes",
    // ⚠️ `/products/price-lists` TIENE QUE ESTAR AQUI. `permissionForPath`
    // compara por prefijo, y `/products` pertenece al modulo `products`, que es
    // `permission: null` a proposito (todo el equipo consulta el catalogo). Sin
    // esta linea la pantalla de listas de precios quedaria abierta a cualquier
    // cajero — y ahi se definen los precios de venta. Funciona porque la funcion
    // ordena de ruta MAS larga a MENOS, asi que esta gana a `/products`.
    //
    // Las demas pantallas de este modulo son pestañas dentro de `/products` y
    // por eso no aparecen aqui.
    paths: ["/products/price-lists"],
    permission: "inventory.manage",
    grantable: true,
  },
  {
    // UN solo módulo para dos pantallas: ambas se rigen por `purchases.manage`,
    // así que no se pueden conceder por separado. Tenerlas como dos módulos
    // daba dos switches que controlaban lo mismo, y el permiso viajaba
    // duplicado al guardar. `permissionForPath` compara por prefijo y
    // "/purchase-orders" NO coincide con "/purchases", por eso hacen falta las
    // dos rutas explícitas: si no, esa quedaría sin proteger.
    key: "purchases",
    label: "Compras y órdenes de compra",
    description: "Compras a proveedores y pedidos pendientes de recibir",
    paths: ["/purchases", "/purchase-orders"],
    permission: "purchases.manage",
    grantable: true,
  },
  {
    key: "finances",
    label: "Finanzas",
    description: "Caja, movimientos de dinero y cortes",
    paths: ["/finances"],
    // `cash.manage`, no `finances.manage`. La pantalla es POR USUARIO: muestra
    // unicamente la caja del que la abre (`fetchActiveRegister(userId)`) y sus
    // movimientos, nunca las de sus companeros. Y el cajero TIENE que entrar
    // aqui: desde que el POS exige caja abierta, sin acceso a esta pantalla no
    // podria vender. `finances.manage` sigue existiendo y gobierna en la base
    // lo que va mas alla de la caja propia (ver migracion 062).
    permission: "cash.manage",
    grantable: true,
  },
  {
    // Dashboard y Reportes van JUNTOS: los dos enseñan las cifras del negocio
    // (ventas del dia y del mes, ganancia, ticket promedio). Con dos modulos
    // habria dos switches controlando en secreto el mismo permiso (el fallo
    // que ya se corrigio en Compras). Desde la migracion 088 el cajero no lo
    // tiene de fabrica: entra directo al Punto de venta (`inicioPara`).
    key: "reports",
    label: "Reportes y dashboard",
    description: "Cifras del negocio: ventas, productos y ganancias",
    paths: ["/reports", "/dashboard"],
    permission: "sales.view_reports",
    grantable: true,
  },
  {
    // Quien hizo que y cuando. Hasta la migracion 088 no pedia permiso y la
    // veia cualquiera; ahora lo tienen de fabrica los administradores, y la
    // politica de `activity_logs` exige el mismo permiso.
    key: "activity",
    label: "Bitácora",
    description: "Quién creó, editó o eliminó qué y cuándo",
    paths: ["/activity"],
    permission: "activity.view",
    grantable: true,
  },
  {
    key: "settings",
    label: "Configuración",
    description: "Datos del negocio y módulos activos",
    paths: ["/settings"],
    permission: "org.manage_settings",
    grantable: true,
  },
  {
    // Cubre el modulo `/branches` Y la tarjeta de Sucursales de Configuracion.
    // "/settings" NO se declara aqui: se lo robaria al modulo de arriba
    // (`permissionForPath` resuelve por prefijo y un test impide que dos
    // modulos reclamen la misma ruta). Configuracion sigue con
    // `org.manage_settings`; dentro, la tarjeta se esconde con este permiso.
    //
    // De fabrica lo tiene SOLO el SUPER_ADMIN (migracion 077), pero es
    // `grantable` porque dar de alta un local no reparte poder como si lo hacen
    // Usuarios o Facturacion: el dueño puede cederselo a un encargado.
    key: "branches",
    label: "Sucursales",
    description: "Locales del negocio: alta, cierre, existencias y traspasos",
    paths: ["/branches"],
    permission: "org.manage_branches",
    grantable: true,
  },
  // --- No concedibles: reparten poder ---
  {
    key: "users",
    label: "Usuarios",
    description: "Invitar, eliminar y cambiar roles",
    paths: ["/users"],
    permission: "org.manage_members",
    grantable: false,
    notGrantableReason:
      "Quien administra usuarios puede ascender a otros y a sí mismo. Solo el dueño reparte poder.",
  },
  {
    key: "billing",
    label: "Facturación y suscripción",
    description: "Plan, pagos y cancelación de la suscripción",
    paths: ["/billing"],
    permission: "subscription.manage",
    grantable: false,
    notGrantableReason:
      "Permite cambiar el plan y cancelar la suscripción del negocio.",
  },
];

/** Los que el SUPER_ADMIN puede activar o desactivar por usuario. */
export const GRANTABLE_MODULES = MODULES.filter((m) => m.grantable);

/**
 * Permisos concedibles. Debe coincidir con el CHECK de
 * `user_permission_overrides`, que hoy define la migración **088** (antes la
 * 055, la 070 y la 077; lo redefine entero quien lo toca).
 *
 * Si se añade uno aquí sin añadirlo allí, la base de datos lo rechaza y el
 * switch falla al guardar. Ya pasó con `cash.manage`, que estuvo roto desde la
 * migración 062 hasta la 077 sin que nadie se enterara. Lo vigila
 * `src/__tests__/modules.test.ts`.
 */
export const GRANTABLE_PERMISSIONS = new Set(
  GRANTABLE_MODULES.map((m) => m.permission).filter((p): p is string => p !== null)
);

/** Permiso que protege una ruta, o `null` si está abierta a todo miembro. */
export function permissionForPath(path: string): string | null {
  // Se aplana módulo×ruta y se ordena de MÁS específica a MENOS, para que
  // "/settings/payments" no resuelva por "/settings" si algún día se separan.
  const candidatos = MODULES.flatMap((m) =>
    m.paths.map((ruta) => ({ ruta, permission: m.permission }))
  ).sort((a, b) => b.ruta.length - a.ruta.length);

  const match = candidatos.find(
    (c) => path === c.ruta || path.startsWith(`${c.ruta}/`)
  );

  return match?.permission ?? null;
}
