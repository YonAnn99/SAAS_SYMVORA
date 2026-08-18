import { conektaPlansApi, CONEKTA_PLAN_ID, CONEKTA_PLAN_AMOUNT, TRIAL_PERIOD_DAYS } from "./config";

export async function ensurePlanExists(): Promise<string> {
  try {
    const planRequest = {
      id: CONEKTA_PLAN_ID,
      name: "SYMVORA Basico",
      amount: CONEKTA_PLAN_AMOUNT,
      currency: "MXN",
      interval: "month" as const,
      frequency: 1,
      trial_period_days: TRIAL_PERIOD_DAYS,
      max_retries: 3,
    };

    const response = await conektaPlansApi.createPlan(planRequest);
    const plan = response.data;
    return plan.id || CONEKTA_PLAN_ID;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 409 || err.message?.includes("already")) {
      return CONEKTA_PLAN_ID;
    }
    throw error;
  }
}

export async function getPlan(planId: string) {
  const response = await conektaPlansApi.getPlan(planId);
  return response.data;
}
