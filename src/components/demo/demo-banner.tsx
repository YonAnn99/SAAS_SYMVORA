"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function DemoBanner() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);

  // Lazy state init: la primera lectura solo corre en el cliente (este
  // componente es "use client"), asi que sessionStorage es seguro. El query
  // param se consulta en cada render para reflejar cambios de navegacion
  // interna. Cualquiera de las dos fuentes activa el banner.
  const [isDemoFromStorage] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("demo_active") === "1";
    } catch {
      return false;
    }
  });
  const isDemoFromQuery = searchParams?.get("demo") === "1";
  const isDemo = isDemoFromQuery || isDemoFromStorage;

  if (!isDemo) return null;

  const handleExit = async () => {
    setSigningOut(true);
    try {
      sessionStorage.removeItem("demo_active");
    } catch {
      // ignore
    }
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // ignore: even if signOut fails, redirect away
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 text-sm sm:text-base font-medium">
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t("landing.demo.banner.text")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/es/signup"
            className="inline-flex items-center gap-1.5 bg-white text-blue-700 font-semibold px-3.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
          >
            {t("landing.demo.banner.cta")}
          </Link>
          <button
            type="button"
            onClick={handleExit}
            disabled={signingOut}
            aria-label={t("landing.demo.banner.exit")}
            className="inline-flex items-center gap-1.5 text-white/90 hover:text-white font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("landing.demo.banner.exit")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
