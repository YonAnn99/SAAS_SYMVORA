import { CustomersApi, Configuration, PlansApi, SubscriptionsApi } from "conekta";
import https from "https";
import { SUBSCRIPTION_PRICE_CENTS } from "@/lib/pricing";

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

// Conekta NO permite cambiar el monto de un plan ya creado: `createPlan` sobre
// un id existente responde "ya existe" y el plan conserva su precio original.
// Por eso cada cambio de precio obliga a versionar el id — los planes viejos
// quedan huérfanos sirviendo a quienes ya estaban suscritos (que conservan su
// precio a propósito).
//   v1  -> $400 / $3,840, con el bug de trial_period_days duplicado
//   v2  -> $400 / $3,840, trial corregido
//   v3  -> $399 / $3,588 (25% de ahorro anual)
export const CONEKTA_PLAN_IDS = {
  monthly: "symvora-basic-monthly-v3",
  yearly: "symvora-basic-yearly-v3",
} as const;
export const CONEKTA_PLAN_AMOUNTS = SUBSCRIPTION_PRICE_CENTS;
