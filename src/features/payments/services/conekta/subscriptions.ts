import { conektaSubscriptionsApi } from "./config";

export async function createSubscription(params: {
  customerId: string;
  cardId: string;
  planId: string;
}) {
  const subscriptionRequest = {
    plan_id: params.planId,
    card_id: params.cardId,
  };

  const response = await conektaSubscriptionsApi.createSubscription(
    params.customerId,
    subscriptionRequest
  );
  return response.data;
}

export async function getSubscription(customerId: string) {
  const response = await conektaSubscriptionsApi.getSubscription(customerId);
  return response.data;
}

export async function cancelSubscription(customerId: string) {
  const response = await conektaSubscriptionsApi.cancelSubscription(customerId);
  return response.data;
}

export async function pauseSubscription(customerId: string) {
  const response = await conektaSubscriptionsApi.pauseSubscription(customerId);
  return response.data;
}

export async function resumeSubscription(customerId: string) {
  const response = await conektaSubscriptionsApi.resumeSubscription(customerId);
  return response.data;
}
