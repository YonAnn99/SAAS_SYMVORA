import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

export async function getReferrerBusinessName(code: string): Promise<string | null> {
  const clean = code.trim();
  if (!clean) return null;

  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("tenants")
    .select("nombre_comercial")
    .eq("codigo_referido", clean.toUpperCase())
    .maybeSingle();

  return data?.nombre_comercial ?? null;
}

export async function getReferrerId(code: string): Promise<string | null> {
  const clean = code.trim();
  if (!clean) return null;

  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("codigo_referido", clean.toUpperCase())
    .maybeSingle();

  return data?.id ?? null;
}