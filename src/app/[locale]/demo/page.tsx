"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

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

    async function startDemo() {
      try {
        const res = await fetch("/api/demo/start", { method: "POST" });
        const data = (await res.json()) as { redirect_url?: string; error?: string };

        if (cancelled) return;

        if (!res.ok || !data.redirect_url) {
          setError(data.error ?? "No se pudo iniciar la demo.");
          return;
        }

        window.location.href = data.redirect_url;
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
