import { CustomersApi, Configuration, PlansApi, SubscriptionsApi } from "conekta";

const apiKey = process.env.CONEKTA_PRIVATE_KEY;

if (!apiKey) {
  console.warn("CONEKTA_PRIVATE_KEY not set. Conekta integration will not work.");
}

const config = new Configuration({ accessToken: apiKey || "" });

export const conektaCustomersApi = new CustomersApi(config);
export const conektaPlansApi = new PlansApi(config);
export const conektaSubscriptionsApi = new SubscriptionsApi(config);

export const CONEKTA_PLAN_ID = "symvora-basic";
export const CONEKTA_PLAN_AMOUNT = 40000; // $400 MXN in centavos
export const TRIAL_PERIOD_DAYS = 7;
