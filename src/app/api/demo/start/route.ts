import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";

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
  //    Lo devolvemos al cliente: despues de `verifyOtp` exitoso, este hace
  //    `router.push("/<locale>/dashboard?demo=1")`.
  const locale = resolveLocale(request);

  // 3. Genera magic link para demo@symvora.com. El `redirectTo` es requerido por
  //    la Admin API (campo obligatorio en `options`), pero no se usa para el
  //    flujo del cliente: en su lugar el cliente verifica el `token_hash` localmente
  //    con `supabase.auth.verifyOtp`. Mantener un redirectTo valido evita warnings
  //    y queda como red de seguridad si en el futuro se quisiera volver al
  //    flujo por email.
  const callbackUrl = new URL("/api/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callbackUrl.searchParams.set("next", `/${locale}/dashboard?demo=1`);
  const redirectTo = callbackUrl.toString();

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
      options: { redirectTo },
    });

  // `generateLink({ type: "magiclink" })` devuelve:
  //   - `properties.action_link`: URL absoluto hacia Supabase (https://<ref>.supabase.co/auth/v1/verify?...)
  //     pensado para enviar por email al usuario.
  //   - `properties.hashed_token`: el token de un solo uso (en el SDK se llama
  //     `hashed_token`; otros SDKs lo exponen como `token_hash`) que el cliente
  //     puede canjear llamando a `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`.
  //     IMPORTANTE: no incluir `email` en esa llamada — verifyOtp trata
  //     `token_hash` y `email+token` como modos mutuamente excluyentes; mandar
  //     ambos dispara el error de GoTrue "Only the token_hash and type should
  //     be provided". Seguimos devolviendo `email` en la respuesta solo para
  //     validación en el cliente, no para pasarlo a verifyOtp.
  //
  // El cliente no debe seguir `action_link` directamente: Supabase lo sirve desde
  // su propio dominio (pagina de confirmacion) y no encadena un redirect al callback
  // con `code`. En su lugar, devolvemos `hashed_token` + `email` para que el cliente
  // verifique el OTP y establezca la sesion localmente.
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    console.error("[demo/start] generateLink failed:", linkError);
    return NextResponse.json(
      { error: "No se pudo generar el acceso a la demo." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    email: DEMO_EMAIL,
    token_hash: hashedToken,
    locale,
    tenant_id: (resetData as { tenant_id?: string } | null)?.tenant_id ?? null,
  });
}
