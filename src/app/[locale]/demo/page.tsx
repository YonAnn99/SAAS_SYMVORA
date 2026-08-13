"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DemoEntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    if (!locale) return;

    let cancelled = false;
    const resolvedLocale = locale;

    async function startDemo() {
      try {
        const res = await fetch(
          `/api/demo/start?locale=${encodeURIComponent(resolvedLocale)}`,
          { method: "POST" }
        );
        const data = (await res.json()) as {
          email?: string;
          token_hash?: string;
          locale?: string;
          error?: string;
        };

        if (cancelled) return;

        if (!res.ok || !data.email || !data.token_hash) {
          setError(data.error ?? "No se pudo iniciar la demo.");
          return;
        }

        const supabase = createSupabaseBrowserClient();

        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: data.email,
          token_hash: data.token_hash,
          type: "magiclink",
        });

        if (cancelled) return;

        if (verifyError) {
          console.error("[demo] verifyOtp failed:", verifyError);
          setError(
            verifyError.message ||
              "No se pudo validar el acceso a la demo. Intenta de nuevo."
          );
          return;
        }

        // Marca la sesion como demo en sessionStorage como respaldo. Si por
        // algun motivo se pierde el query param `?demo=1` durante navegaciones
        // internas del dashboard, el banner seguira mostrandose.
        try {
          sessionStorage.setItem("demo_active", "1");
        } catch {
          // sessionStorage no disponible (modo incognito restrictivo): el
          // query param sigue siendo la fuente primaria.
        }

        // Hard navigation para que el middleware refresque la sesion antes de
        // evaluar las RLS del dashboard. `router.push` solo re-renderiza cliente
        // y el server cookie store quedaria desincronizado en el primer fetch.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- requiere hard reload para sincronizar cookies tras verifyOtp
        window.location.href = `/${data.locale ?? resolvedLocale}/dashboard?demo=1`;
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error de red");
      }
    }

    startDemo();

    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-200 p-8 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
          <Sparkles className="w-8 h-8 text-blue-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-black">
          {error ? "Error al iniciar la demo" : "Preparando tu demo..."}
        </h1>
        <p className="text-neutral-500 leading-relaxed">
          {error ?? (
            <>
              Estamos cargando los datos de{" "}
              <strong>Abarrotes Don Pedro</strong>: productos, clientes, ventas
              del último mes y caja abierta. Te llevamos al dashboard en un
              momento.
            </>
          )}
        </p>
        {error ? (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al inicio
          </button>
        ) : (
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}
