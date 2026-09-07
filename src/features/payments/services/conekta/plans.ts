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
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 409 || err.message?.includes("already")) {
      return planId;
    }
    throw error;
  }
}

export async function getPlan(planId: string) {
  const response = await conektaPlansApi.getPlan(planId);
  return response.data;
}
