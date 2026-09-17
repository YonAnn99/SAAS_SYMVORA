"use client";

/**
 * Si este dispositivo esta o no listo para trabajar sin internet.
 *
 * Existe porque el fallo original era ciego: la PWA no abria en modo avion y no
 * habia forma de saber por que sin tener el telefono delante y un cable. Ahora
 * el propio cajero puede mirarlo, y el boton "Preparar ahora" resuelve el caso
 * mas comun sin que nadie tenga que entender nada.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  inspeccionarCaches,
  leerInforme,
  type CacheInspeccionada,
  type WarmReport,
} from "@/lib/offline/diagnostics";
import {
  rutasAPrecalentar,
  rutasEnCache,
  warmOfflineRoutes,
} from "@/lib/offline/route-cache";

const NOMBRES: Record<string, string> = {
  "/dashboard": "Panel",
  "/pos": "Punto de Venta",
};

function nombreDeRuta(path: string): string {
  const sinLocale = path.replace(/^\/[a-z]{2}/, "");
  return NOMBRES[sinLocale] ?? path;
}

export function OfflineStatusPanel() {
  const locale = useLocale();
  const [guardadas, setGuardadas] = useState<Set<string> | null>(null);
  const [informe, setInforme] = useState<WarmReport | null>(null);
  const [caches, setCaches] = useState<CacheInspeccionada[]>([]);
  const [preparando, setPreparando] = useState(false);

  const revisar = useCallback(async () => {
    setGuardadas(await rutasEnCache(locale));
    setInforme(leerInforme());
    setCaches(await inspeccionarCaches());
  }, [locale]);

  useEffect(() => {
    const t = window.setTimeout(() => void revisar(), 0);
    return () => window.clearTimeout(t);
  }, [revisar]);

  const prepararAhora = async () => {
    setPreparando(true);
    try {
      await warmOfflineRoutes(locale, { force: true, trigger: "manual" });
      await revisar();
    } finally {
      setPreparando(false);
    }
  };

  const rutas = rutasAPrecalentar(locale);
  const todoListo = guardadas !== null && rutas.every((r) => guardadas.has(r));

  return (
    <section className="rounded-lg border border-border p-3 text-sm">
      <h3 className="mb-2 font-medium">Estado del modo sin conexión</h3>

      <ul className="space-y-1.5">
        {rutas.map((ruta) => {
          const lista = guardadas?.has(ruta) ?? false;
          return (
            <li key={ruta} className="flex items-center gap-2">
              {guardadas === null ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : lista ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <span>{nombreDeRuta(ruta)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {guardadas === null
                  ? "revisando..."
                  : lista
                    ? "guardado"
                    : "no guardado"}
              </span>
            </li>
          );
        })}
      </ul>

      {guardadas !== null && !todoListo && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Con internet, pulsa &quot;Preparar ahora&quot;. Hasta que las dos
          digan &quot;guardado&quot;, la app no abrirá en modo avión.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-8"
        onClick={() => void prepararAhora()}
        disabled={preparando}
      >
        {preparando ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        )}
        {preparando ? "Preparando..." : "Preparar ahora"}
      </Button>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Detalles técnicos</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 leading-relaxed">
          {JSON.stringify(
            {
              ultimoIntento: informe ?? "(ninguno)",
              caches: caches.map((c) => `${c.nombre}: ${c.entradas}`),
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}
