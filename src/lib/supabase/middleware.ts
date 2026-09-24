import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { after, type NextRequest, NextResponse } from "next/server";
import { permissionForPath } from "@/lib/modules";
import { inicioPara } from "@/lib/inicio";
import type { UserRole } from "@/lib/types/database";

const APP_HOST = "https://app.symvora.com.mx";
const MARKETING_HOST = "https://www.symvora.com.mx";
// Host dedicado para la demo publica: al vivir en su propio subdominio, el
// navegador aisla su cookie de sesion de Supabase de la de app.symvora.com.mx
// (ningun cliente de Supabase en este proyecto fija un `domain` explicito,
// asi que el alcance de cookie por host ya alcanza para separar ambas
// sesiones sin tocar nada mas). Ver docs/demo-isolation.md.
const DEMO_HOST = "demo.symvora.com.mx";
const PROD_HOSTS = new Set([
  "app.symvora.com.mx",
  "www.symvora.com.mx",
  "symvora.com.mx",
  DEMO_HOST,
]);
const MARKETING_SEGMENTS = [
  "/marketing",
  "/terminos",
  "/aviso-privacidad",
  "/politica-cookies",
  // Una pagina por giro (/es/punto-de-venta/papelerias): se sirve en www y es
  // publica. Sin esto, en produccion redirigiria al host de la app, y sin
  // sesion terminaria en el login en lugar de mostrarse.
  "/punto-de-venta",
];

// Routes that require ORG_ADMIN or higher
const ADMIN_ONLY_PATHS = [
  "/users",
  "/settings",
  "/finances",
  "/purchases",
  "/purchase-orders",
  "/facturas",
  "/inventory-adjustments",
  "/variants",
  "/lots",
  // ⚠️ ESTA LISTA ES LA QUE ENCIENDE EL CONTROL, `modules.ts` solo dice QUE
  // permiso pedir. Declarar la ruta alli y no aqui la deja SIN PROTEGER: el
  // bloque de `permissionForPath` ni siquiera se ejecuta. Es el caso de
  // `/products/price-lists`, que cuelga de `/products` — una ruta abierta a
  // todo el equipo a proposito — pero donde se definen los precios de venta.
  "/products/price-lists",
  "/pos",
  // Cifras del negocio y auditoria (migracion 088). `/dashboard` ya no esta
  // abierto a todos: el cajero va al POS (`inicioPara`). `/reports` estaba
  // declarado en modules.ts pero faltaba aqui, asi que nadie lo comprobaba.
  "/dashboard",
  "/reports",
  "/activity",
];

// Modules temporarily disabled for everyone, regardless of role.
// Not deleted — just gated off here until re-enabled.
const DISABLED_PATHS = ["/facturas"];

// Routes that require SUPER_ADMIN only
const SUPER_ADMIN_ONLY_PATHS = [
  "/billing",
  // Aqui y no en ADMIN_ONLY_PATHS a proposito. El control principal es por
  // permiso (`org.manage_branches`, cedible por usuario); pero si faltara el
  // contexto de permisos, el respaldo por rol exigiria SUPER_ADMIN en vez de
  // dejar pasar a cualquier ORG_ADMIN.
  "/branches",
];

const ROLE_HIERARCHY: Record<string, number> = {
  CAJERO: 1,
  ORG_ADMIN: 2,
  SUPER_ADMIN: 3,
};

function stripLocale(path: string): string {
  const match = path.match(/^\/(es|en)(?=\/|$)/);
  return match ? path.slice(match[0].length) || "/" : path;
}

function isMarketingPath(path: string): boolean {
  const clean = stripLocale(path);
  if (clean === "/") return true;
  return MARKETING_SEGMENTS.some(
    (segment) => clean === segment || clean.startsWith(`${segment}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const host = request.headers.get("host") ?? "";

  // Host routing: app.symvora.com.mx sirve el sistema, www/apex el marketing.
  // En dev (localhost) y previews de Vercel no se aplica.
  if (PROD_HOSTS.has(host)) {
    const isAppHost = host === "app.symvora.com.mx" || host === DEMO_HOST;
    const isMarketing = isMarketingPath(request.nextUrl.pathname);

    if (isAppHost && isMarketing) {
      return NextResponse.redirect(
        new URL(request.nextUrl.pathname + request.nextUrl.search, MARKETING_HOST),
        308
      );
    }

    if (!isAppHost && !isMarketing) {
      return NextResponse.redirect(
        new URL(request.nextUrl.pathname + request.nextUrl.search, APP_HOST),
        308
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Missing Supabase env vars:", { url: !!url, anonKey: !!anonKey });
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.includes("/login") ||
    request.nextUrl.pathname.includes("/signup") ||
    request.nextUrl.pathname.includes("/auth") ||
    request.nextUrl.pathname.includes("/reset-password") ||
    // Quien entra con Google por primera vez tiene sesion pero no negocio, y
    // aqui lo da de alta. No puede pasar por el chequeo de negocio de abajo:
    // ese chequeo es justo el que lo manda aqui.
    request.nextUrl.pathname.includes("/completar-registro");

  const isLegalRoute = ["/aviso-privacidad", "/terminos", "/politica-cookies"].some(
    (segment) => request.nextUrl.pathname.endsWith(segment)
  );

  // /billing es "publica" solo para efectos del redirect de login y del
  // chequeo de suscripcion (bug #9: una suscripcion expirada redirige a
  // /billing, y si /billing exigiera suscripcion se cicla). El chequeo de ROL
  // si debe correr ahi — no puede ciclarse porque manda a /dashboard, otra
  // ruta. Antes caia dentro de `!isPublicRoute` y por eso
  // SUPER_ADMIN_ONLY_PATHS era codigo muerto: cualquier CAJERO entraba a
  // /billing y podia cancelar la suscripcion del negocio.
  const isBillingRoute = (() => {
    const clean = stripLocale(request.nextUrl.pathname);
    return clean === "/billing" || clean.startsWith("/billing/");
  })();

  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/marketing") ||
    request.nextUrl.pathname.startsWith("/api/conekta") ||
    request.nextUrl.pathname.startsWith("/api/mercadopago/webhook") ||
    request.nextUrl.pathname.includes("/billing") ||
    request.nextUrl.pathname.includes("/demo") ||
    isLegalRoute ||
    isMarketingPath(request.nextUrl.pathname) ||
    /^\/(es|en)$/.test(request.nextUrl.pathname);

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    const locale = request.nextUrl.pathname.split("/")[1] || "es";
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Subscription + role access control for authenticated users on dashboard.
  //
  // UNA SOLA consulta para todo. Esto corre en cada navegacion autenticada, y
  // antes encadenaba hasta 4 round trips secuenciales (membresia -> tenant ->
  // suscripcion -> permisos efectivos) contra un PostgREST con pool pequeño.
  // `get_middleware_context` (migracion 060) los resuelve de una vez porque
  // todos cuelgan del mismo user_id.
  if (user && !isAuthRoute && (!isPublicRoute || isBillingRoute)) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: contexto, error: errorContexto } = await supabaseAdmin
        .rpc("get_middleware_context", { p_user_id: user.id })
        .maybeSingle<{
          tenant_id: string;
          rol: UserRole;
          subscription_status: string | null;
          trial_end: string | null;
          permisos: string[];
          tiene_caja_abierta: boolean;
        }>();

      // SIN NEGOCIO -> a terminar el registro. Pasa con la primera entrada con
      // Google: Supabase crea el usuario al volver, pero el negocio solo lo
      // crea el formulario. Antes se le dejaba pasar y veia un panel sin
      // nombre, sin rol y con medio menu.
      //
      // Solo si la consulta RESPONDIO sin negocio. Con un error (red, pool
      // lleno) no se sabe, y redirigir haria un bucle: la pagina de registro
      // comprueba la membresia por su cuenta y lo devolveria al dashboard.
      if (!contexto && !errorContexto) {
        const locale = request.nextUrl.pathname.split("/")[1] || "es";
        const completarUrl = request.nextUrl.clone();
        completarUrl.pathname = `/${locale === "en" ? "en" : "es"}/completar-registro`;
        completarUrl.search = "";
        return NextResponse.redirect(completarUrl);
      }

      // Se conserva la forma de `membership` para no tocar el resto del bloque.
      const membership = contexto
        ? { tenant_id: contexto.tenant_id, role: contexto.rol }
        : null;

      // --- Subscription check ---
      // Se salta en /billing a proposito: es la pagina a la que redirige este
      // mismo chequeo, y evaluarla ahi produce el redirect loop del bug #9.
      if (contexto && !isBillingRoute) {
        const status = contexto.subscription_status;

        // Redirect to billing if expired or past_due
        if (status === "expired" || status === "past_due") {
          const billingUrl = request.nextUrl.clone();
          const locale = request.nextUrl.pathname.split("/")[1] || "es";
          billingUrl.pathname = `/${locale}/billing`;
          return NextResponse.redirect(billingUrl);
        }

        // Check if trial has expired
        if (
          status === "trial" &&
          contexto.trial_end &&
          new Date(contexto.trial_end) < new Date()
        ) {
          // La escritura NO bloquea el redirect: marcar el tenant como expirado
          // es contabilidad interna, y quien navega solo necesita llegar a
          // /billing. Dejarla en la ruta critica añadia un round trip a una
          // respuesta que de todas formas es una redireccion.
          after(async () => {
            await supabaseAdmin
              .from("tenants")
              .update({ subscription_status: "expired" })
              .eq("id", contexto.tenant_id);
          });

          const billingUrl = request.nextUrl.clone();
          const locale = request.nextUrl.pathname.split("/")[1] || "es";
          billingUrl.pathname = `/${locale}/billing`;
          return NextResponse.redirect(billingUrl);
        }
      }

      // --- Role-based route protection ---
      const cleanPath = stripLocale(request.nextUrl.pathname);

      const isDisabled = DISABLED_PATHS.some(
        (path) => cleanPath === path || cleanPath.startsWith(`${path}/`)
      );
      if (isDisabled) {
        const locale = request.nextUrl.pathname.split("/")[1] || "es";
        const inicioUrl = request.nextUrl.clone();
        inicioUrl.pathname = `/${locale}${inicioPara(contexto?.permisos ?? [])}`;
        return NextResponse.redirect(inicioUrl);
      }

      const requiresSuperAdmin = SUPER_ADMIN_ONLY_PATHS.some(
        (path) => cleanPath === path || cleanPath.startsWith(`${path}/`)
      );
      const requiresOrgAdmin = ADMIN_ONLY_PATHS.some(
        (path) => cleanPath === path || cleanPath.startsWith(`${path}/`)
      );

      if (requiresSuperAdmin || requiresOrgAdmin) {
        // Se decide por PERMISO EFECTIVO, no por rol. Desde la migración 055 el
        // SUPER_ADMIN puede conceder un módulo a un usuario concreto, y si esta
        // capa siguiera mirando el rol, esa persona tendría el permiso en la
        // base de datos pero el middleware le cerraría la ruta igualmente.
        const requiredPermission = permissionForPath(cleanPath);
        let allowed: boolean;

        if (requiredPermission && contexto) {
          // Los permisos efectivos ya vinieron en el mismo RPC de arriba: aqui
          // no hay consulta adicional.
          allowed = contexto.permisos.includes(requiredPermission);
        } else {
          // Ruta protegida que no está mapeada en modules.ts: se cae al
          // criterio anterior por rol en vez de dejarla pasar.
          const userRole = membership?.role || "CAJERO";
          const requiredRole = requiresSuperAdmin
            ? "SUPER_ADMIN"
            : requiredPermission === "sales.create" || requiredPermission === "cash.manage"
            ? "CAJERO"
            : "ORG_ADMIN";
          allowed = (ROLE_HIERARCHY[userRole] || 0) >= ROLE_HIERARCHY[requiredRole];
        }

        if (!allowed) {
          // A SU inicio y no al dashboard: el cajero tampoco puede verlo, y
          // mandarlo ahi seria otra negativa y otra redireccion (bucle).
          const locale = request.nextUrl.pathname.split("/")[1] || "es";
          const inicioUrl = request.nextUrl.clone();
          inicioUrl.pathname = `/${locale}${inicioPara(contexto?.permisos ?? [])}`;
          return NextResponse.redirect(inicioUrl);
        }
      }
    }
  }

  return supabaseResponse;
}
