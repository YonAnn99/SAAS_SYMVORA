import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

const acceptSchema = z.object({
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
  cookiesVersion: z.string().min(1),
});

function extractClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = extractClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? null;

    const { error } = await supabase.from("legal_acceptances").insert({
      user_id: user.id,
      terms_version: parsed.data.termsVersion,
      privacy_version: parsed.data.privacyVersion,
      cookies_version: parsed.data.cookiesVersion,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      // Si es un duplicate (user ya aceptó esta misma versión), no fallamos — es idempotente.
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      return NextResponse.json(
        { error: "Failed to record acceptance", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ versions: LEGAL_DOCUMENT_VERSIONS });
}
