import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Proveedor,
  PurchaseWithRelations,
} from "../types/inventory.types";

export const purchaseStatusColors: Record<string, string> = {
  PENDIENTE: "bg-[#FBF3DB] text-[#956400] dark:bg-[#956400]/20 dark:text-[#E5C46B]",
  RECIBIDA: "bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]",
  CANCELADA: "bg-[#FDEBEC] text-[#9F2F2D] dark:bg-[#9F2F2D]/20 dark:text-[#F2A5A4]",
};

export interface PurchaseInput {
  proveedorId: string;
  numeroFactura: string;
  total: number;
}

export interface SupplierInput {
  nombre: string;
  contact: string;
  email: string;
  phone: string;
}

export async function fetchTenantIdForUser(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return membership?.tenant_id ?? null;
}

export async function fetchPurchases(tenantId: string): Promise<PurchaseWithRelations[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("compras")
    .select(`
      *,
      proveedor:proveedores!proveedor_id(nombre)
    `)
    .eq("tenant_id", tenantId)
    .order("fecha_compra", { ascending: false });
  return data ?? [];
}

export async function fetchSuppliers(tenantId: string): Promise<Proveedor[]> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("proveedores")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");
  return data ?? [];
}

export async function createPurchase(
  tenantId: string,
  userId: string,
  input: PurchaseInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("compras").insert({
    tenant_id: tenantId,
    proveedor_id: input.proveedorId,
    usuario_id: userId,
    numero_factura: input.numeroFactura || null,
    total: input.total,
  });
  if (error) throw error;
}

export async function createSupplier(
  tenantId: string,
  input: SupplierInput
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("proveedores").insert({
    tenant_id: tenantId,
    nombre: input.nombre,
    contact_name: input.contact || null,
    email: input.email || null,
    telefono: input.phone || null,
  });
  if (error) throw error;
}

export async function updatePurchaseStatus(
  purchaseId: string,
  estado: "PENDIENTE" | "RECIBIDA" | "CANCELADA"
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const updates: { estado: string; fecha_recepcion?: string } = { estado };
  if (estado === "RECIBIDA") {
    updates.fecha_recepcion = new Date().toISOString();
  }
  const { error } = await supabase
    .from("compras")
    .update(updates)
    .eq("id", purchaseId);
  if (error) throw error;
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("compras").delete().eq("id", purchaseId);
  if (error) throw error;
}