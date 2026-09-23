import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShoppingCartIcon,
  Wallet,
  Settings,
  Users,
  Contact,
  FileText,
  TrendingUp,
  CreditCard,
  Receipt,
  Smartphone,
  Lightbulb,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { permissionForPath } from "@/lib/modules";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/types/database";

/**
 * Fuente unica del menu de navegacion del panel.
 *
 * POR QUE VIVE AQUI Y NO EN EL SIDEBAR: la busqueda global (Ctrl+K) mantenia su
 * propia copia con 8 de los 14 modulos y en otro orden. Dos listas separadas
 * divergen siempre — es el mismo motivo por el que en este repo ya son fuente
 * unica `modules.ts` (que modulo exige que permiso), `profit.ts`, `route-cache.ts`
 * y `stock-status.ts`. Un test fija el orden para que añadir un modulo al final
 * salga en rojo en vez de desordenar el menu en silencio.
 *
 * ⚠️ EL ORDEN IMPORTA MAS ALLA DE LO VISUAL: el tutorial localiza enlaces con
 * `document.querySelector('a[href*="..."]')`, que devuelve la PRIMERA
 * coincidencia del documento. Si se mete una ruta que sea prefijo de otra
 * (`/settings` lo es de `/settings/payments`), el selector puede resolver al
 * enlace equivocado. Ver `steps-data.tsx`, donde el selector de Configuracion
 * esta anclado con `$=` justo por esto.
 */
export interface NavItem {
  /** Clave i18n, no texto literal. */
  name: string;
  href: string;
  icon: LucideIcon;
  beta?: boolean;
  /**
   * Segundo filtro, solo para rutas sin permiso mapeado en `modules.ts`.
   * La decision principal es por permiso efectivo (migracion 055).
   */
  minRole?: UserRole;
  /** Fuera del menu sin borrar la entrada (modulo CFDI apagado). */
  hidden?: boolean;
  /**
   * Solo aparece si el negocio tiene 2 o mas sucursales ACTIVAS. Es un filtro
   * por DATOS, no por permiso: el dueño de una tienda de un solo local no debe
   * ver un modulo de sucursales vacio, aunque tenga el permiso.
   */
  requiresMultiSucursal?: boolean;
}

/**
 * Orden pedido por el dueño del negocio: operacion diaria arriba,
 * administracion en medio, cuenta y ajustes al final.
 */
export const NAVIGATION: NavItem[] = [
  // --- Operacion diaria: lo que se toca cada dia, visible para todo el equipo.
  { name: "layout.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "layout.pos", href: "/pos", icon: ShoppingCart },
  { name: "layout.products", href: "/products", icon: Package },
  { name: "layout.customers", href: "/customers", icon: Contact },

  // --- Dinero y analisis.
  // Finanzas ya NO lleva `minRole`: desde la migracion 062 la ruta exige
  // `cash.manage`, que tambien tiene el CAJERO para operar su propia caja. Un
  // `minRole: "ORG_ADMIN"` aqui seria codigo muerto (el permiso manda) y, peor,
  // haria creer que el cajero no entra — cuando tiene que entrar para poder
  // abrir caja y vender.
  { name: "layout.finances", href: "/finances", icon: Wallet },
  { name: "layout.reports", href: "/reports", icon: TrendingUp },

  // --- Abastecimiento.
  { name: "layout.purchases", href: "/purchases", icon: ShoppingCartIcon, minRole: "ORG_ADMIN" },
  { name: "layout.purchaseOrders", href: "/purchase-orders", icon: FileText, minRole: "ORG_ADMIN" },

  // --- Administracion del negocio.
  { name: "common.activityLog", href: "/activity", icon: FileText },
  { name: "layout.users", href: "/users", icon: Users, minRole: "SUPER_ADMIN" },
  // Aparece sola al dar de alta la segunda sucursal (desde Configuracion); con
  // un solo local no hay nada que gestionar aqui.
  { name: "layout.branches", href: "/branches", icon: Store, requiresMultiSucursal: true },

  // --- Cuenta y cobro.
  { name: "layout.payments", href: "/settings/payments", icon: Smartphone, minRole: "ORG_ADMIN" },
  { name: "layout.billing", href: "/billing", icon: CreditCard, minRole: "SUPER_ADMIN" },
  // Modulo CFDI apagado por decision de negocio (sesion 2026-09-05). No se
  // borra: para reactivarlo basta con quitar `hidden` (ver CONTEXT.md).
  { name: "layout.facturas", href: "/facturas", icon: Receipt, beta: true, minRole: "ORG_ADMIN", hidden: true },

  // --- Buzon y ajustes, al final.
  { name: "layout.suggestions", href: "/suggestions", icon: Lightbulb },
  { name: "layout.settings", href: "/settings", icon: Settings, minRole: "ORG_ADMIN" },
];

/** Lo que se pinta: descarta los modulos apagados. */
export const VISIBLE_NAVIGATION = NAVIGATION.filter((item) => !item.hidden);

/**
 * Rutas que tienen titulo propio pero NO entrada de menu.
 *
 * `/variants`, `/lots` e `/inventory-adjustments` son redirecciones heredadas a
 * `/products?tab=…` (se dejaron vivas para no romper enlaces guardados, sesion
 * 2026-09-11). No deben aparecer en el menu, pero si alguien llega por un
 * enlace viejo el encabezado tiene que decir donde esta.
 */
const RUTAS_SIN_MENU: Record<string, string> = {
  "/variants": "layout.variants",
  "/lots": "layout.lots",
  "/inventory-adjustments": "layout.adjustments",
  // Se llega desde el boton de /products, no desde el menu lateral.
  "/products/price-lists": "layout.priceLists",
};

/** Candidatos ordenados de ruta MAS especifica a MENOS. */
const CANDIDATOS_TITULO = [
  // Se incluyen tambien los ocultos: /facturas no sale en el menu pero la
  // pagina existe y necesita titulo.
  ...NAVIGATION.map((i) => ({ ruta: i.href, clave: i.name })),
  ...Object.entries(RUTAS_SIN_MENU).map(([ruta, clave]) => ({ ruta, clave })),
].sort((a, b) => b.ruta.length - a.ruta.length);

/** Quita el prefijo de idioma para poder comparar rutas por igualdad. */
export function stripLocale(path: string): string {
  return path.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
}

/**
 * Clave i18n del titulo que corresponde a una ruta, o `null` si no se reconoce.
 *
 * ORDENA POR LONGITUD Y COMPARA POR IGUALDAD O PREFIJO DE SEGMENTO, igual que
 * `permissionForPath` en `modules.ts`. El encabezado hacia antes
 * `path.includes(ruta)` recorriendo un objeto en orden de declaracion, y eso
 * tenia dos fallos: `/settings/payments` resolvia a "Configuracion" porque
 * `/settings` estaba declarado antes y es subcadena, y cualquier ruta ausente
 * del mapa caia a un fallback que afirmaba "Dashboard" — decir el modulo
 * equivocado es peor que no decir ninguno.
 */
export function moduleLabelKeyForPath(path: string): string | null {
  const limpia = stripLocale(path);
  const match = CANDIDATOS_TITULO.find(
    (c) => limpia === c.ruta || limpia.startsWith(`${c.ruta}/`)
  );
  return match?.clave ?? null;
}

/**
 * Que modulos puede ver esta persona. La comparten el menu lateral y la
 * busqueda global: si cada uno filtrara por su cuenta volverian a divergir,
 * que es como la busqueda acabo enseñando Usuarios y Configuracion a los
 * cajeros.
 *
 * Decide por PERMISO EFECTIVO, no por rol: desde la migracion 055 el
 * SUPER_ADMIN puede conceder o quitar modulos a un usuario concreto, asi que
 * dos personas con el mismo rol pueden ver menus distintos. `minRole` queda
 * como segundo filtro solo para las rutas que no estan mapeadas en
 * `modules.ts` (Dashboard, Clientes, Bitacora, Sugerencias).
 *
 * ⚠️ Llamar solo cuando el rol ya resolvio. Con `role` en `null`,
 * `hasRole` devuelve `false` para todo lo que tenga `minRole` y se pinta unos
 * cientos de ms el subconjunto de CAJERO aunque la persona sea dueña (el bug
 * del sidebar del 2026-09-04). Quien llame debe esperar a `loading`.
 */
export function filterNavigation(
  role: UserRole | null,
  can: (permission: string) => boolean,
  opciones: { multiSucursal?: boolean } = {}
): NavItem[] {
  return NAVIGATION.filter((item) => {
    if (item.hidden) return false;
    // Antes que el permiso: sin varias sucursales el modulo no se enseña a
    // nadie, ni al dueño.
    if (item.requiresMultiSucursal && !opciones.multiSucursal) return false;
    const permission = permissionForPath(item.href);
    if (permission) return can(permission);
    return !item.minRole || hasRole(role, item.minRole);
  });
}
