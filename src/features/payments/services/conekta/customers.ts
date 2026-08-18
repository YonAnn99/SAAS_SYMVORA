import { conektaCustomersApi } from "./config";

export async function createCustomer(params: {
  name: string;
  email: string;
  phone?: string;
}): Promise<string> {
  const customerData = {
    name: params.name,
    email: params.email,
    phone: params.phone || "",
  };

  const response = await conektaCustomersApi.createCustomer(customerData);
  const customer = response.data;
  return customer.id || "";
}

export async function getCustomer(customerId: string) {
  const response = await conektaCustomersApi.getCustomerById(customerId);
  return response.data;
}

export async function deleteCustomer(customerId: string) {
  const response = await conektaCustomersApi.deleteCustomerById(customerId);
  return response.data;
}
