import { CustomersApi, Configuration, PlansApi, SubscriptionsApi } from "conekta";
import https from "https";

const apiKey = process.env.CONEKTA_PRIVATE_KEY;

if (!apiKey) {
  console.warn("CONEKTA_PRIVATE_KEY not set. Conekta integration will not work.");
}

// The conekta SDK's ESM build references a CA bundle file
// (dist/esm/cert/ca_bundle.crt) that isn't actually included in the
// published package — only dist/cert/ca_bundle.crt exists. That causes
// "ENOENT ... dist/esm/cert/ca_bundle.crt" on every request. Passing our
// own httpsAgent short-circuits that code path (the SDK only loads the
// cert when no httpsAgent is already set), using Node's default trust
// store, which is sufficient for HTTPS to api.conekta.io.
const conektaHttpsAgent = new https.Agent();

const config = new Configuration({
  accessToken: apiKey || "",
  baseOptions: { httpsAgent: conektaHttpsAgent },
});

export const conektaCustomersApi = new CustomersApi(config);
export const conektaPlansApi = new PlansApi(config);
export const conektaSubscriptionsApi = new SubscriptionsApi(config);

export const CONEKTA_PLAN_ID = "symvora-basic";
export const CONEKTA_PLAN_AMOUNT = 40000; // $400 MXN in centavos
export const TRIAL_PERIOD_DAYS = 7;
