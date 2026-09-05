export interface NewCustomerForm {
  nombre: string;
  telefono: string;
  email: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal_receptor: string;
  uso_cfdi: string;
  codigo_postal: string;
}

export const EMPTY_NEW_CUSTOMER: NewCustomerForm = {
  nombre: "",
  telefono: "",
  email: "",
  rfc: "",
  razon_social: "",
  regimen_fiscal_receptor: "",
  uso_cfdi: "",
  codigo_postal: "",
};

export type CreditMetodoPago =
  | "EFECTIVO"
  | "TARJETA"
  | "TRANSFERENCIA"
  | "TARJETA_TERMINAL";