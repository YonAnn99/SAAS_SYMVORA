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

export const CONEKTA_PLAN_IDS = {
  monthly: "symvora-basic-monthly-v2",
  yearly: "symvora-basic-yearly-v2",
} as const;
export const CONEKTA_PLAN_AMOUNTS = {
  monthly: 40000, // $400 MXN in centavos
  yearly: 384000, // $320 MXN/mes x 12, en centavos
} as const;
