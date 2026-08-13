import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("legal_acceptances")
      .select("terms_version, privacy_version, cookies_version, accepted_at")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch", details: error.message },
        { status: 500 }
      );
    }

    const current = data ?? {
      terms_version: null,
      privacy_version: null,
      cookies_version: null,
      accepted_at: null,
    };

    return NextResponse.json({
      accepted: current,
      current: LEGAL_DOCUMENT_VERSIONS,
      needsUpdate:
        current.terms_version !== LEGAL_DOCUMENT_VERSIONS.terms ||
        current.privacy_version !== LEGAL_DOCUMENT_VERSIONS.privacy ||
        current.cookies_version !== LEGAL_DOCUMENT_VERSIONS.cookies,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
