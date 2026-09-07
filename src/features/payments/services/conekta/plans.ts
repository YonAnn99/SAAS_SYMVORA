import { conektaPlansApi, CONEKTA_PLAN_IDS, CONEKTA_PLAN_AMOUNTS, TRIAL_PERIOD_DAYS } from "./config";

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
      trial_period_days: TRIAL_PERIOD_DAYS,
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
