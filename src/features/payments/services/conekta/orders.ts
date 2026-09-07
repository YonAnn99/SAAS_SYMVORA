import { OrdersApi, Configuration } from "conekta";
import https from "https";

const apiKey = process.env.CONEKTA_PRIVATE_KEY;

// See src/lib/conekta/config.ts for why this is needed — the conekta
// SDK's ESM build looks for a CA bundle at a path that isn't shipped in
// the package, so we supply our own httpsAgent to skip that broken
// code path.
const conektaHttpsAgent = new https.Agent();

const config = new Configuration({
  accessToken: apiKey || "",
  baseOptions: { httpsAgent: conektaHttpsAgent },
});
const ordersApi = new OrdersApi(config);

export async function createHostedCheckoutOrder(params: {
  customerId: string;
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl?: string;
  allowedPaymentMethods?: string[];
}) {
  const orderRequest = {
    currency: "MXN",
    customer_info: {
      customer_id: params.customerId,
    },
    line_items: [
      {
        name: params.description,
        quantity: 1,
        unit_price: params.amount,
      },
    ],
    checkout: {
      type: "HostedPayment" as const,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      failure_url: params.failureUrl || params.cancelUrl,
      allowed_payment_methods: (params.allowedPaymentMethods || [
        "card",
        "cash",
        "bank_transfer",
      ]) as Array<
        | "card"
        | "cash"
        | "bank_transfer"
        | "bnpl"
        | "pay_by_bank"
        | "apple"
        | "google"
      >,
      name: params.description,
      redirection_time: 20,
    },
  };

  const response = await ordersApi.createOrder(orderRequest);
  return response.data;
}

// Cobro recurrente real: a diferencia de createHostedCheckoutOrder (orden de
// una sola exhibición vía line_items), aquí el checkout lleva checkout.plan_ids
// — Conekta tokeniza y guarda la tarjeta en su propia página y crea una
// Subscription de verdad, que cobra sola cada periodo del plan. Solo soportado
// para tarjeta (Conekta no permite suscripciones en efectivo). El SDK de
// Conekta no tipa `plan_ids` en CheckoutRequest todavía, de ahí el cast.
export async function createSubscriptionCheckout(params: {
  customerId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl?: string;
}) {
  const orderRequest = {
    currency: "MXN",
    customer_info: {
      customer_id: params.customerId,
    },
    checkout: {
      type: "HostedPayment" as const,
      plan_ids: [params.planId],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      failure_url: params.failureUrl || params.cancelUrl,
      allowed_payment_methods: ["card"] as Array<"card">,
      redirection_time: 20,
    } as Record<string, unknown>,
  };

  const response = await ordersApi.createOrder(
    orderRequest as unknown as Parameters<typeof ordersApi.createOrder>[0]
  );
  return response.data;
}

export async function getOrder(orderId: string) {
  const response = await ordersApi.getOrderById(orderId);
  return response.data;
}

export async function refundOrder(params: {
  orderId: string;
  amountCents: number;
  reason: string;
}) {
  const response = await ordersApi.orderRefund(params.orderId, {
    amount: params.amountCents,
    reason: params.reason,
  });
  return response.data;
}
