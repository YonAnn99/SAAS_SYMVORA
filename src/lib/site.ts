const DEFAULT_SITE_URL = "https://saas-symvora.vercel.app";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/+$/, "") : DEFAULT_SITE_URL;
}
