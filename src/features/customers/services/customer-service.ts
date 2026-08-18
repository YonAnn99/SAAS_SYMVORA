import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cliente } from "@/lib/types/database";
import type { NewCustomerForm } from "../types/customer.types";

export async function fetchCustomers(tenantId: string): Promise<Cliente[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");

  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(
  tenantId: string,
  form: NewCustomerForm
): Promise<Cliente> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      tenant_id: tenantId,
      nombre: form.nombre.trim(),
      telefono: form.telefono || null,
      email: form.email || null,
      rfc: form.rfc.trim() || null,
      razon_social: form.razon_social.trim() || null,
      regimen_fiscal_receptor: form.regimen_fiscal_receptor || null,
      uso_cfdi: form.uso_cfdi || null,
      codigo_postal: form.codigo_postal || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}