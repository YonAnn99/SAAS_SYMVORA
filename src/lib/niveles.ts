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

import type { BillingPeriod } from "@/lib/pricing";

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
 * Rutas del menú que el nivel no incluye. Básico no tiene el módulo de Sucursales ni el Catálogo en línea.
 * Solo esconde el acceso: la regla de verdad la aplican los triggers de la migración 140.
 */
export function rutaPermitidaPorPlan(ruta: string, f: FuncionesPlan): boolean {
  if (ruta === "/online-catalog" || ruta.startsWith("/online-catalog/")) return f.catalogo;
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
