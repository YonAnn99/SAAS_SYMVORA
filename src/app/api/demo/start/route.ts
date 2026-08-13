import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Rate limit en memoria: 5 requests / minuto / IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

const DEMO_EMAIL = "demo@symvora.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SUPPORTED_LOCALES = ["es", "en"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function resolveLocale(request: Request): SupportedLocale {
  // 1. Query param explícito enviado por la página cliente (?locale=en).
  //    Es la fuente más confiable porque refleja el locale del router de next-intl.
  try {
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get("locale");
    if (fromQuery && (SUPPORTED_LOCALES as readonly string[]).includes(fromQuery)) {
      return fromQuery as SupportedLocale;
    }
  } catch {
    // ignore
  }

  // 2. Header Accept-Language del navegador como fallback.
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const primary = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("en")) return "en";
  return "es";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un minuto." },
      { status: 429 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Configuración de Supabase incompleta." },
      { status: 500 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  // 1. Reset del snapshot (idempotente, serializado con advisory lock en la RPC).
  const { data: resetData, error: resetError } = await supabase.rpc(
    "reset_demo_tenant"
  );

  if (resetError) {
    console.error("[demo/start] reset_demo_tenant failed:", resetError);
    return NextResponse.json(
      { error: `No se pudo inicializar la demo: ${resetError.message}` },
      { status: 500 }
    );
  }

  // 2. Resolver locale del usuario para preservar el idioma en el redirect.
  const locale = resolveLocale(request);

  // 3. Genera magic link para demo@symvora.com. La redirectTo lleva al callback
  //    existente, que intercambia code por session y redirige a /<locale>/dashboard?demo=1.
  //    Importante: el valor de `next` se pasa via URLSearchParams.set, que lo URL-encodea
  //    automaticamente. Si se concatenara como string crudo, el segundo `?` (de demo=1)
  //    se parsearia como un searchParam separado y el callback perderia el flag.
  const callbackUrl = new URL("/api/auth/callback", APP_URL);
  callbackUrl.searchParams.set("next", `/${locale}/dashboard?demo=1`);
  const redirectTo = callbackUrl.toString();

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
      options: { redirectTo },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[demo/start] generateLink failed:", linkError);
    return NextResponse.json(
      { error: "No se pudo generar el acceso a la demo." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    redirect_url: linkData.properties.action_link,
    tenant_id: (resetData as { tenant_id?: string } | null)?.tenant_id ?? null,
  });
}
