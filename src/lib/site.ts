const DEFAULT_SITE_URL = "https://www.symvora.com.mx";
const DEFAULT_APP_URL = "https://app.symvora.com.mx";

function resolveUrl(fromEnv: string | undefined, fallback: string): string {
  const isLocalInProd = process.env.NODE_ENV === "production" && fromEnv?.includes("localhost");
  return fromEnv && fromEnv.length > 0 && !isLocalInProd ? fromEnv.replace(/\/+$/, "") : fallback;
}

export function getSiteUrl(): string {
  return resolveUrl(process.env.NEXT_PUBLIC_SITE_URL?.trim(), DEFAULT_SITE_URL);
}

export function getAppUrl(): string {
  return resolveUrl(process.env.NEXT_PUBLIC_APP_URL?.trim(), DEFAULT_APP_URL);
}
