/**
 * ⚠️ ESTE BARRIL ES SOLO DE SERVIDOR. No lo importes desde un componente
 * `"use client"`.
 *
 * Hoy no lo importa nadie, asi que el peligro es latente — pero el dia que un
 * componente cliente escriba `from "@/features/payments"`, `export *` arrastra
 * TODOS los modulos de aqui a su bundle, y dos de ellos rompen el build de
 * produccion con:
 *
 *   You're importing a module that depends on "next/headers".
 *   This API is only available in Server Components in the App Router...
 *
 * Eso ya paso el 2026-09-21 con el barril de `cash-register`, que reexportaba
 * su servicio de servidor y lo consumia `pos/page.tsx`. Lo caro no fue
 * arreglarlo —una linea— sino encontrarlo: **`next dev` y `tsc --noEmit` no lo
 * detectan**. Es un limite del empaquetador, no de tipos, asi que solo aparece
 * al desplegar.
 *
 * DOS NIVELES DE PELIGRO, marcados abajo:
 *
 *   [ROMPE EL BUILD] importan `next/headers` a traves de `server.server.ts`.
 *   [SOLO SERVIDOR]  leen secretos sin `NEXT_PUBLIC_`. No los filtrarian —en el
 *                    navegador valen `undefined`— pero empaquetarian el SDK de
 *                    pagos entero y fallarian en tiempo de ejecucion sin decir
 *                    por que. `conekta/config` ademas instancia el SDK al
 *                    importarse, que es la razon de que `create-checkout` lo
 *                    cargue con un import dinamico.
 *
 * Si algun dia hace falta algo de aqui en el cliente: importalo por su RUTA
 * DIRECTA, nunca por este barril. Es lo que ya hace el cron de cierre de cajas.
 * El unico modulo pensado para el navegador es `mercadopago/browser`.
 */

/** El unico seguro en el navegador. */
export * from "./services/mercadopago/browser";

export * from "./services/mercadopago/config"; //       [SOLO SERVIDOR] MERCADO_PAGO_API_URL
export * from "./services/mercadopago/order-amount"; // [ROMPE EL BUILD] next/headers
export * from "./services/mercadopago/orders";
export * from "./services/mercadopago/secrets"; //      [ROMPE EL BUILD] next/headers
export * from "./services/mercadopago/webhook";

export * from "./services/conekta/config"; //           [SOLO SERVIDOR] CONEKTA_PRIVATE_KEY + instancia el SDK
export * from "./services/conekta/customers";
export {
  createHostedCheckoutOrder,
  refundOrder,
  getOrder as getConektaOrder,
} from "./services/conekta/orders"; //                   [SOLO SERVIDOR] CONEKTA_PRIVATE_KEY
export * from "./services/conekta/plans";
export * from "./services/conekta/subscriptions";

export * from "./types/payments.types";
