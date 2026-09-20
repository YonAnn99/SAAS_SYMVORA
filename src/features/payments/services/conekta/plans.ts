import { conektaPlansApi, CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS } from "./config";
import type { ClavePlan } from "../../promocion";

// Nombre e intervalo por plan. Antes se derivaban de `period === "yearly"`, que
// dejo de servir en cuanto hubo un tercer plan: el promocional tambien es
// mensual, asi que esa comparacion le habria puesto el nombre y el intervalo
// del anual a nada y lo habria dejado indistinguible del normal en el panel de
// Conekta, que es donde se concilia el dinero.
const DEFINICION: Record<ClavePlan, { nombre: string; intervalo: "month" | "year" }> = {
  monthly: { nombre: "SYMVORA Basico Mensual", intervalo: "month" },
  yearly: { nombre: "SYMVORA Basico Anual", intervalo: "year" },
  monthlyPromo: { nombre: "SYMVORA Basico Mensual - Promo -50%", intervalo: "month" },
};

export async function ensurePlanExists(clave: ClavePlan): Promise<string> {
  const planId = CONEKTA_PLAN_IDS[clave];
  const { nombre, intervalo } = DEFINICION[clave];
  try {
    const planRequest = {
      id: planId,
      name: nombre,
      amount: CONEKTA_PLAN_AMOUNTS[clave],
      currency: "MXN",
      interval: intervalo,
      frequency: 1,
      // Sin trial aquí: el trial de 14 días ya lo maneja SYMVORA a nivel de
      // app (subscriptions.trial_end) antes de que el usuario llegue a
      // "Pagar con tarjeta". Ponerle trial también al plan de Conekta
      // duplicaba el periodo de prueba y retrasaba el primer cobro
      // real, incluso para quien decide pagar de inmediato.
      trial_period_days: 0,
      max_retries: 3,
    };

    const response = await conektaPlansApi.createPlan(planRequest);
    const plan = response.data;
    return plan.id || planId;
  } catch (error: unknown) {
    // err.message es el genérico de axios ("Request failed with status code
    // XXX") — el detalle real de Conekta (ej. "El recurso ya existe",
    // code: conekta.errors.parameter_validation.id.found) viene en
    // err.response.data.details, no en err.message.
    const err = error as {
      response?: {
        status?: number;
        data?: { details?: Array<{ code?: string; param?: string }> };
      };
      message?: string;
    };
    const details = err.response?.data?.details ?? [];
    const alreadyExists =
      err.response?.status === 409 ||
      err.message?.includes("already") ||
      details.some((d) => d.param === "id" || d.code?.includes("id.found"));
    if (alreadyExists) {
      // El plan ya existe en Conekta y su monto es inmutable. Si no coincide
      // con el precio vigente, seguiríamos cobrando el precio viejo en
      // silencio (ya pasó dos veces: por eso los ids van en -v3). Avisamos
      // fuerte en logs; el fix es bumpear CONEKTA_PLAN_IDS, no editar el plan.
      try {
        const existing = await getPlan(planId);
        const expected = CONEKTA_PLAN_AMOUNTS[clave];
        if (existing.amount !== expected) {
          console.error(
            `[conekta/plans] El plan "${planId}" ya existe en Conekta con amount=${existing.amount} ` +
              `pero el precio vigente es ${expected} centavos. Conekta no permite editar el monto: ` +
              `bumpea CONEKTA_PLAN_IDS a una version nueva para aplicar el precio nuevo.`
          );
        }
      } catch {
        // No poder leer el plan no debe tumbar el checkout: es solo la verificación.
      }
      return planId;
    }
    throw error;
  }
}

export async function getPlan(planId: string) {
  const response = await conektaPlansApi.getPlan(planId);
  return response.data;
}
