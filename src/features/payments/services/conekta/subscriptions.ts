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

/**
 * Cambia el plan de una suscripcion viva conservando la tarjeta guardada.
 *
 * Es lo que cierra la promocion de lanzamiento: al tercer cobro de $199 la
 * suscripcion pasa del plan promocional al normal y el cuarto ya sale a $399.
 * La alternativa era `expiry_count: 3` en el plan promocional, pero eso TERMINA
 * la suscripcion y obligaria al cliente a capturar la tarjeta otra vez —
 * perderlo en el mes 4 es justo lo contrario de lo que busca la promocion.
 */
export async function cambiarPlan(customerId: string, planId: string) {
  const response = await conektaSubscriptionsApi.updateSubscription(customerId, {
    plan_id: planId,
  });
  return response.data;
}
