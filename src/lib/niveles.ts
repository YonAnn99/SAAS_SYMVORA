/**
 * Niveles de suscripción: Básico, Pro y Premium (migración 140).
 *
 * FUENTE ÚNICA DEL LADO DEL CÓDIGO. Su espejo en la base es `plan_funciones(tenant)` (migración 140): lo
 * que el menú esconde y lo que los triggers rechazan tienen que decir lo mismo, y `niveles.test.ts` lo
 * compara leyendo la migración.
 *
 *              sucursales   lealtad   catálogo en línea   pedidos del catálogo
 *   Básico         1         no            no                    no
 *   Pro            3         sí            sí                    sí
 *   Premium     ilimitadas   sí            sí                    sí
 *   heredado    ilimitadas   sí            sí                    sí
 *
 * «Heredado» (`nivel` NULL en `subscriptions`) son los clientes de antes de los niveles y quien está en la
 * prueba de 14 días: tienen todo, sin tope. Solo un cobro confirmado de un nivel nuevo lo cambia.
 *
 * Usuarios, productos, POS, inventario, caja, compras, reportes, lotes y etiquetas son ilimitados en TODOS.
 *
 * Los PRECIOS viven aquí (y no en `pricing.ts`, que es el del plan único de siempre) porque Conekta no
 * permite cambiar el monto de un plan ya creado: cada cifra de esta tabla da un plan nuevo en Conekta
 * (`CONEKTA_PLAN_IDS`, ids `-v1`). Si una cifra cambia, hay que versionar el id (`-v2`).
 */

import { PROMO_LANZAMIENTO, type BillingPeriod } from "@/lib/pricing";

export type Nivel = "basico" | "pro" | "premium";

/** De menor a mayor: el orden en que se muestran y en que se compara «subir de plan». */
export const NIVELES_ORDEN: readonly Nivel[] = ["basico", "pro", "premium"];

export interface FuncionesPlan {
  /** `null` = heredado (sin nivel). */
  nivel: Nivel | null;
  /** Tope de sucursales ACTIVAS; `null` = sin tope. */
  sucursalesMax: number | null;
  lealtad: boolean;
  catalogo: boolean;
  pedidos: boolean;
}

export const FUNCIONES_POR_NIVEL: Record<Nivel, FuncionesPlan> = {
  basico: { nivel: "basico", sucursalesMax: 1, lealtad: false, catalogo: false, pedidos: false },
  pro: { nivel: "pro", sucursalesMax: 3, lealtad: true, catalogo: true, pedidos: true },
  premium: { nivel: "premium", sucursalesMax: null, lealtad: true, catalogo: true, pedidos: true },
};

/** Sin nivel: todo permitido. También lo que se asume mientras carga o si falla la red. */
export const FUNCIONES_HEREDADO: FuncionesPlan = {
  nivel: null,
  sucursalesMax: null,
  lealtad: true,
  catalogo: true,
  pedidos: true,
};

export function esNivel(valor: unknown): valor is Nivel {
  return valor === "basico" || valor === "pro" || valor === "premium";
}

export function funcionesDe(nivel: Nivel | null | undefined): FuncionesPlan {
  return nivel ? FUNCIONES_POR_NIVEL[nivel] : FUNCIONES_HEREDADO;
}

/** Lo que devuelve `info_plan` (jsonb) convertido a la forma del código. */
export interface InfoPlan {
  funciones: FuncionesPlan;
  sucursalesUsadas: number;
}

export const INFO_PLAN_HEREDADO: InfoPlan = { funciones: FUNCIONES_HEREDADO, sucursalesUsadas: 0 };

export function leerInfoPlan(json: unknown): InfoPlan {
  if (!json || typeof json !== "object") return INFO_PLAN_HEREDADO;
  const j = json as Record<string, unknown>;
  const nivel = esNivel(j.nivel) ? j.nivel : null;
  // Se confía en el NIVEL y no en los campos sueltos: si el servidor mandara algo raro, el
  // resultado sigue siendo uno de los cuatro conjuntos conocidos.
  return {
    funciones: funcionesDe(nivel),
    sucursalesUsadas: typeof j.sucursales_usadas === "number" ? j.sucursales_usadas : 0,
  };
}

/** Funciones que un nivel puede tener o no (para el aviso «Disponible en Pro»). */
export type FuncionDePlan = "sucursales" | "lealtad" | "catalogo" | "pedidos";

/** Nivel más barato que incluye cada función. */
export const NIVEL_MINIMO: Record<FuncionDePlan, Nivel> = {
  sucursales: "pro",
  lealtad: "pro",
  catalogo: "pro",
  pedidos: "pro",
};

/** ¿Puede usar esta función? `sucursales` = el módulo de varias sucursales (más de una). */
export function permiteFuncion(f: FuncionesPlan, funcion: FuncionDePlan): boolean {
  switch (funcion) {
    case "sucursales":
      return f.sucursalesMax === null || f.sucursalesMax > 1;
    case "lealtad":
      return f.lealtad;
    case "catalogo":
      return f.catalogo;
    case "pedidos":
      return f.pedidos;
  }
}

/** ¿Puede dar de alta otra sucursal activa? */
export function puedeAgregarSucursal(f: FuncionesPlan, usadas: number): boolean {
  return f.sucursalesMax === null || usadas < f.sucursalesMax;
}

/**
 * Rutas del menú que el nivel no incluye. Básico no tiene el módulo de Sucursales, el Catálogo en línea ni Pedidos.
 * Solo esconde el acceso: la regla de verdad la aplican los triggers de la migración 140.
 */
export function rutaPermitidaPorPlan(ruta: string, f: FuncionesPlan): boolean {
  if (ruta === "/online-catalog" || ruta.startsWith("/online-catalog/")) return f.catalogo;
  if (ruta === "/orders" || ruta.startsWith("/orders/")) return f.pedidos;
  if (ruta === "/branches" || ruta.startsWith("/branches/")) return permiteFuncion(f, "sucursales");
  return true;
}

/**
 * Precio de lista de cada nivel, en centavos. Anual = (mensual × 0.75, redondeado al peso) × 12: el mismo
 * ~25 % de ahorro que el plan de siempre ($399 → $3,588).
 */
export const PRECIOS_NIVEL_CENTS: Record<Nivel, Record<BillingPeriod, number>> = {
  basico: { monthly: 24900, yearly: 224400 }, // $249 · $2,244 ($187/mes)
  pro: { monthly: 44900, yearly: 404400 }, // $449 · $4,044 ($337/mes)
  premium: { monthly: 59900, yearly: 538800 }, // $599 · $5,388 ($449/mes)
};

/**
 * ¿Le caben a este nivel las sucursales activas que ya tiene el negocio? Es el MISMO criterio que aplican
 * `create-checkout`/`asignar_nivel` (409 `demasiadas_sucursales`), adelantado a la pantalla para avisar ANTES de pagar.
 */
export function nivelQueCabe(nivel: Nivel, sucursalesActivas: number): boolean {
  const max = FUNCIONES_POR_NIVEL[nivel].sucursalesMax;
  return max === null || sucursalesActivas <= max;
}

/** El nivel más bajo al que le caben las sucursales activas (Básico ≤1, Pro ≤3, Premium el resto). */
export function nivelSugerido(sucursalesActivas: number): Nivel {
  return NIVELES_ORDEN.find((n) => nivelQueCabe(n, sucursalesActivas)) ?? "premium";
}

/** Nivel con el que se arranca la selección: Pro (el que se destaca) si le cabe; si no, el más bajo que le quepa. */
export function nivelInicial(sucursalesActivas: number): Nivel {
  return nivelQueCabe("pro", sucursalesActivas) ? "pro" : nivelSugerido(sucursalesActivas);
}

/** Cuántas sucursales tendría que cerrar para que le quepan en este nivel. */
export function sucursalesPorCerrar(nivel: Nivel, sucursalesActivas: number): number {
  const max = FUNCIONES_POR_NIVEL[nivel].sucursalesMax;
  return max === null ? 0 : Math.max(0, sucursalesActivas - max);
}

export type FuncionQueSeApaga = "catalogo" | "lealtad" | "pedidos";

/**
 * Lo que dejaría de funcionar al elegir este nivel desde una prueba (todo incluido). Nunca se borra nada: el catálogo
 * se apaga, las tarjetas de lealtad quedan congeladas y no se reciben pedidos.
 */
export function funcionesQueSeApagan(nivel: Nivel): FuncionQueSeApaga[] {
  const f = FUNCIONES_POR_NIVEL[nivel];
  const fuera: FuncionQueSeApaga[] = [];
  if (!f.catalogo) fuera.push("catalogo");
  if (!f.lealtad) fuera.push("lealtad");
  if (!f.pedidos) fuera.push("pedidos");
  return fuera;
}

/**
 * ¿Le toca la promoción de lanzamiento (−50 %, `PROMO_LANZAMIENTO`) a quien contrata ESTE nivel y periodo
 * ahora? Solo Pro y Premium, y solo mensual: Básico va siempre a precio de lista y el anual no lleva promo.
 * Responde "¿se ofrece?"; lo que se le cobra a una suscripción concreta lo manda su contador en la base.
 */
export function promoAplicaANivel(nivel: Nivel, periodo: BillingPeriod): boolean {
  return PROMO_LANZAMIENTO.activa && periodo === PROMO_LANZAMIENTO.periodo && nivel !== "basico";
}

/**
 * Precio promocional mensual de cada nivel, en centavos, REDONDEADO por decision del dueño (2026-11-25):
 * Pro $225 (lista $449) y Premium $299 (lista $599). Basico no tiene promo. Los planes de Conekta
 * (`proMonthlyPromo`/`premiumMonthlyPromo`) toman el monto de aqui: si cambia una cifra, versionar el id (-v2).
 */
export const PRECIOS_PROMO_NIVEL_CENTS = { pro: 22500, premium: 29900 } as const;

/** Precio promocional mensual de un nivel Pro/Premium, en centavos. Basico no lo tiene (devuelve su lista). */
export function precioPromoNivelCents(nivel: Nivel): number {
  return nivel === "basico" ? PRECIOS_NIVEL_CENTS.basico.monthly : PRECIOS_PROMO_NIVEL_CENTS[nivel];
}

export function precioPromoNivelMXN(nivel: Nivel): number {
  return precioPromoNivelCents(nivel) / 100;
}

/** «$449» si es entero y «$224.50» si no: los precios de la landing no llevan «.00». */
export function formatPrecioNivel(mxn: number): string {
  return Number.isInteger(mxn) ? `$${mxn.toLocaleString("es-MX")}` : `$${mxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function precioNivelCents(nivel: Nivel, periodo: BillingPeriod): number {
  return PRECIOS_NIVEL_CENTS[nivel][periodo];
}

export function precioNivelMXN(nivel: Nivel, periodo: BillingPeriod): number {
  return precioNivelCents(nivel, periodo) / 100;
}

/** Lo que cuesta al mes un nivel pagado por año, en pesos. */
export function precioMensualEquivalenteMXN(nivel: Nivel, periodo: BillingPeriod): number {
  return periodo === "yearly" ? precioNivelMXN(nivel, "yearly") / 12 : precioNivelMXN(nivel, "monthly");
}

/**
 * Interruptor de los niveles. Mientras NO valga `1`, la landing, `/billing` y el checkout venden el plan
 * único de siempre, exactamente como hoy. `NEXT_PUBLIC_*` para que lo lean el navegador y las rutas del
 * servidor; cambiarlo requiere redeploy.
 *
 * Se enciende solo cuando los reels y la landing digan lo mismo que cobra el checkout (la campaña de Meta
 * Ads anuncia «de $399 a $199»).
 */
export function nivelesActivos(): boolean {
  return process.env.NEXT_PUBLIC_NIVELES_ACTIVOS === "1";
}
