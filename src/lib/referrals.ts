export function generateReferralCode(tenantId: string): string {
  // Espejo del generador de 023_referidos.sql: 'SYM' + 8 hex del tenant id.
  const hex = Buffer.from(tenantId.replace(/-/g, ""), "hex").toString("hex");
  return `SYM${hex.slice(0, 8).toUpperCase()}`;
}

export function getReferralSignupUrl(code: string): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isLocalInProd = process.env.NODE_ENV === "production" && envBase?.includes("localhost");
  const base = envBase && !isLocalInProd ? envBase : "https://app.symvora.com.mx";
  return `${base}/es/signup?ref=${encodeURIComponent(code)}`;
}