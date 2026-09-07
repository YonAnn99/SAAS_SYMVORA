import { conektaPlansApi, CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS } from "./config";

export async function ensurePlanExists(
  period: "monthly" | "yearly"
): Promise<string> {
  const planId = CONEKTA_PLAN_IDS[period];
  try {
    const planRequest = {
      id: planId,
      name: period === "yearly" ? "SYMVORA Basico Anual" : "SYMVORA Basico Mensual",
      amount: CONEKTA_PLAN_AMOUNTS[period],
      currency: "MXN",
      interval: (period === "yearly" ? "year" : "month") as "year" | "month",
      frequency: 1,
      // Sin trial aquí: el trial de 7 días ya lo maneja SYMVORA a nivel de
      // app (subscriptions.trial_end) antes de que el usuario llegue a
      // "Pagar con tarjeta". Ponerle trial también al plan de Conekta
      // duplicaba el periodo de prueba y retrasaba 7 días el primer cobro
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
      return planId;
    }
    throw error;
  }
}

export async function getPlan(planId: string) {
  const response = await conektaPlansApi.getPlan(planId);
  return response.data;
}
