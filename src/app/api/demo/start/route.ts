import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import {
  cabecerasRateLimit,
  consumirRateLimit,
  obtenerIpCliente,
} from "@/lib/rate-limit";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";
import { HORAS_DEMO, LIMPIEZA_POR_ENTRADA, MAX_DEMOS_ACTIVAS, correoDemo } from "@/lib/demo";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 30;

// 5 peticiones por minuto y por IP, contadas en Postgres (migracion 058).
// Antes vivia en un `new Map()` de modulo, que en serverless no limitaba nada:
// cada instancia tenia su propio contador y cada arranque en frio lo vaciaba.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

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
  const ip = obtenerIpCliente(request);
  const limite = await consumirRateLimit(
    `demo-start:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SECONDS
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un minuto." },
      { status: 429, headers: cabecerasRateLimit(limite) }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Configuración de Supabase incompleta." },
      { status: 500 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  // 1. Limpieza perezosa: las demos vencidas se borran aqui, en cada entrada
  //    (el cron diario es solo respaldo). Un fallo no frena la entrada.
  const { error: limpiezaError } = await supabase.rpc("borrar_demos_vencidas", {
    p_limite: LIMPIEZA_POR_ENTRADA,
  });
  if (limpiezaError) {
    console.error("[demo/start] borrar_demos_vencidas failed:", limpiezaError.message);
  }

  // 2. Tope de demos vivas: protege la base de quien abra cientos.
  const { count: activas } = await supabase
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .gt("demo_expira_en", new Date().toISOString());
  if ((activas ?? 0) >= MAX_DEMOS_ACTIVAS) {
    return NextResponse.json(
      { error: "La demo está muy solicitada en este momento. Intenta en unos minutos." },
      { status: 503 }
    );
  }

  // 3. El usuario de ESTE visitante: confirmado, sin contraseña y sin correo
  //    (entra por `token_hash`). `is_demo` en app_metadata (solo el servidor la
  //    escribe) es lo que reconocen `demo-guard` y las funciones SQL.
  const email = correoDemo(crypto.randomUUID());
  const { data: creado, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { is_demo: true },
    user_metadata: { nombre: "Visitante" },
  });
  const userId = creado?.user?.id;
  if (createError || !userId) {
    console.error("[demo/start] createUser failed:", createError);
    return NextResponse.json({ error: "No se pudo iniciar la demo." }, { status: 500 });
  }

  // 4. Su negocio, sembrado con los mismos datos de siempre. Si falla, el
  //    usuario recien creado no se queda huerfano.
  const { data: tenantId, error: seedError } = await supabase.rpc("crear_negocio_demo", {
    p_user_id: userId,
    p_horas: HORAS_DEMO,
    p_terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
    p_privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
    p_cookies_version: LEGAL_DOCUMENT_VERSIONS.cookies,
  });
  if (seedError || !tenantId) {
    console.error("[demo/start] crear_negocio_demo failed:", seedError);
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: "No se pudo preparar la demo." }, { status: 500 });
  }

  // 5. Resolver locale del usuario para preservar el idioma en el redirect.
  //    Lo devolvemos al cliente: despues de `verifyOtp` exitoso, este hace
  //    `router.push("/<locale>/dashboard?demo=1")`.
  const locale = resolveLocale(request);

  // 6. Genera el magic link de ESTE usuario. El `redirectTo` es requerido por
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
      email,
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
    await supabase.rpc("borrar_mi_demo", { p_user_id: userId });
    return NextResponse.json(
      { error: "No se pudo generar el acceso a la demo." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    email,
    token_hash: hashedToken,
    locale,
    tenant_id: tenantId as string,
  });
}
