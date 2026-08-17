const DEFAULT_SITE_URL = "https://www.symvora.com.mx";
const DEFAULT_APP_URL = "https://app.symvora.com.mx";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/+$/, "") : DEFAULT_SITE_URL;
}

export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/+$/, "") : DEFAULT_APP_URL;
}
