import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/supabase/auth";
import { assertNotDemo } from "@/lib/supabase/demo-guard";
import { sendInviteKeyEmail } from "@/lib/email";
import { cabecerasRateLimit, consumirRateLimit } from "@/lib/rate-limit";
import type { UserRole } from "@/lib/types/database";

// Presupuesto de ejecucion explicito. Sin el, una llamada lenta a un tercero
// deja la funcion ocupada hasta el tope por defecto de la plataforma.
export const maxDuration = 30;

const INVITABLE_ROLES: UserRole[] = ["ORG_ADMIN", "CAJERO"];
const INVITE_RATE_LIMIT_MAX = 20;
const INVITE_RATE_LIMIT_WINDOW_SECONDS = 3600;

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function POST(request: Request) {
  try {
    const { email, role, tenantId, locale: requestLocale } = await request.json();
    const locale = typeof requestLocale === "string" && /^(es|en)$/.test(requestLocale)
      ? requestLocale
      : "es";

    if (!email || !role || !tenantId) {
      return NextResponse.json(
        { error: "Email, role, and tenantId are required" },
        { status: 400 }
      );
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    const requestedRole: UserRole = role as UserRole;
    if (!INVITABLE_ROLES.includes(requestedRole) && requestedRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Role inválido" },
        { status: 400 }
      );
    }

    const auth = await requireTenantAccess(request, {
      tenantId,
      permission: "org.manage_members_write",
    });
    if (!auth.ok) return auth.response;

    // Se limita despues de autenticar y por tenant, no por IP: cada invitacion
    // dispara un correo real por Resend, asi que el recurso a proteger es la
    // cuota de envio, no el endpoint. Un negocio legitimo no invita a 20
    // personas en una hora.
    const limite = await consumirRateLimit(
      `users-invite:${tenantId}`,
      INVITE_RATE_LIMIT_MAX,
      INVITE_RATE_LIMIT_WINDOW_SECONDS
    );
    if (!limite.permitido) {
      return NextResponse.json(
        { error: "Demasiadas invitaciones en poco tiempo. Intenta más tarde." },
        { status: 429, headers: cabecerasRateLimit(limite) }
      );
    }

    const demo = await assertNotDemo();
    if (!demo.ok) return demo.response;

    if (requestedRole === "SUPER_ADMIN" && auth.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Solo un SUPER_ADMIN puede invitar a otro SUPER_ADMIN" },
        { status: 403 }
      );
    }

    const roleToAssign: UserRole = requestedRole;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate invite key
    const inviteKey = generateKey();

    // Store key in DB
    const { error: insertError } = await supabase
      .from("user_invite_keys")
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        key: inviteKey,
        role: roleToAssign,
      });

    if (insertError) {
      console.error("Failed to store invite key:", insertError);
      return NextResponse.json(
        { error: "Error al generar la clave de invitación" },
        { status: 500 }
      );
    }

    // Send email with key
    const emailResult = await sendInviteKeyEmail({
      to: email,
      key: inviteKey,
      role: roleToAssign,
      locale,
    });

    if (!emailResult.ok) {
      console.error("Failed to send invite email:", emailResult.error);
      // Key was created but email failed - still return success with warning
      return NextResponse.json({
        success: true,
        message: `Clave generada para ${email}: ${inviteKey}`,
        warning: "No se pudo enviar el correo. Comparte la clave manualmente.",
        key: inviteKey,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Invitación enviada a ${email}`,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
