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
      ]) as Array<"card" | "cash" | "bank_transfer">,
      name: params.description,
    },
  };

  const response = await ordersApi.createOrder(orderRequest);
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
