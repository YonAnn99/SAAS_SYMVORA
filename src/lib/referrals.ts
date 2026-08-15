import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export function generateReferralCode(tenantId: string): string {
  // Espejo del generador de 023_referidos.sql: 'SYM' + 8 hex del tenant id.
  const hex = Buffer.from(tenantId.replace(/-/g, ""), "hex").toString("hex");
  return `SYM${hex.slice(0, 8).toUpperCase()}`;
}

export function getReferralSignupUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://saas-symvora.vercel.app";
  return `${base}/es/signup?ref=${encodeURIComponent(code)}`;
}

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