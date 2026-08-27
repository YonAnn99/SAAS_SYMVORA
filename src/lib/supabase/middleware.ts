import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const APP_HOST = "https://app.symvora.com.mx";
const MARKETING_HOST = "https://www.symvora.com.mx";
const PROD_HOSTS = new Set([
  "app.symvora.com.mx",
  "www.symvora.com.mx",
  "symvora.com.mx",
]);
const MARKETING_SEGMENTS = [
  "/marketing",
  "/terminos",
  "/aviso-privacidad",
  "/politica-cookies",
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
];

// Routes that require SUPER_ADMIN only
const SUPER_ADMIN_ONLY_PATHS = [
  "/billing",
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
    const isAppHost = host === "app.symvora.com.mx";
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
    request.nextUrl.pathname.includes("/reset-password");

  const isLegalRoute = ["/aviso-privacidad", "/terminos", "/politica-cookies"].some(
    (segment) => request.nextUrl.pathname.endsWith(segment)
  );

  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/marketing") ||
    request.nextUrl.pathname.startsWith("/api/conekta") ||
    request.nextUrl.pathname.startsWith("/api/mercadopago/webhook") ||
    request.nextUrl.pathname.includes("/billing") ||
    request.nextUrl.pathname.includes("/demo") ||
    isLegalRoute ||
    /^\/(es|en)$/.test(request.nextUrl.pathname);

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    const locale = request.nextUrl.pathname.split("/")[1] || "es";
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Subscription access control for authenticated users on dashboard
  if (user && !isAuthRoute && !isPublicRoute) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: membership } = await supabaseAdmin
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (membership) {
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("subscription_status")
          .eq("id", membership.tenant_id)
          .single();

        const status = tenant?.subscription_status;

        // Redirect to billing if expired or past_due
        if (status === "expired" || status === "past_due") {
          const billingUrl = request.nextUrl.clone();
          const locale = request.nextUrl.pathname.split("/")[1] || "es";
          billingUrl.pathname = `/${locale}/billing`;
          return NextResponse.redirect(billingUrl);
        }

        // Check if trial has expired
        if (status === "trial") {
          const { data: subscription } = await supabaseAdmin
            .from("subscriptions")
            .select("trial_end")
            .eq("tenant_id", membership.tenant_id)
            .single();

          if (subscription?.trial_end && new Date(subscription.trial_end) < new Date()) {
            await supabaseAdmin
              .from("tenants")
              .update({ subscription_status: "expired" })
              .eq("id", membership.tenant_id);

            const billingUrl = request.nextUrl.clone();
            const locale = request.nextUrl.pathname.split("/")[1] || "es";
            billingUrl.pathname = `/${locale}/billing`;
            return NextResponse.redirect(billingUrl);
          }
        }
      }
    }
  }

  // Role-based route protection for authenticated users
  if (user && !isAuthRoute && !isPublicRoute) {
    const cleanPath = stripLocale(request.nextUrl.pathname);
    const requiresSuperAdmin = SUPER_ADMIN_ONLY_PATHS.some(
      (path) => cleanPath === path || cleanPath.startsWith(`${path}/`)
    );
    const requiresOrgAdmin = ADMIN_ONLY_PATHS.some(
      (path) => cleanPath === path || cleanPath.startsWith(`${path}/`)
    );

    if (requiresSuperAdmin || requiresOrgAdmin) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const supabaseAdmin = createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: membership } = await supabaseAdmin
          .from("tenant_memberships")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        const userRole = membership?.role || "CAJERO";
        const requiredRole = requiresSuperAdmin ? "SUPER_ADMIN" : "ORG_ADMIN";

        if ((ROLE_HIERARCHY[userRole] || 0) < ROLE_HIERARCHY[requiredRole]) {
          const locale = request.nextUrl.pathname.split("/")[1] || "es";
          const dashboardUrl = request.nextUrl.clone();
          dashboardUrl.pathname = `/${locale}/dashboard`;
          return NextResponse.redirect(dashboardUrl);
        }
      }
    }
  }

  return supabaseResponse;
}
