import { OrdersApi, Configuration } from "conekta";

const apiKey = process.env.CONEKTA_PRIVATE_KEY;
const config = new Configuration({ accessToken: apiKey || "" });
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
