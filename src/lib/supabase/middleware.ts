import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
    request.nextUrl.pathname.includes("/auth");

  const isLegalRoute = ["/aviso-privacidad", "/terminos", "/politica-cookies"].some(
    (segment) => request.nextUrl.pathname.endsWith(segment)
  );

  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/marketing") ||
    request.nextUrl.pathname.startsWith("/api/conekta") ||
    request.nextUrl.pathname.includes("/billing") ||
    request.nextUrl.pathname.includes("/demo") ||
    isLegalRoute ||
    /^\/(es|en)$/.test(request.nextUrl.pathname);

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/es/login";
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

  return supabaseResponse;
}
