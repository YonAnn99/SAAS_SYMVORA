"use client";

/**
 * Sube a Supabase las ventas que se hicieron sin conexión.
 *
 * Se ejecuta en primer plano (no en el service worker) a propósito. La venta
 * se sube con `supabase.rpc("complete_sale", …)`, que necesita un JWT válido,
 * y los access tokens de Supabase caducan (~1h). El service worker no puede
 * refrescar la sesión de forma fiable —el cliente de Supabase y su refresh
 * token viven en el contexto de la página—, así que un reintento desde ahí
 * fallaría con 401 y gastaría un intento. Aquí se refresca la sesión antes de
 * empezar, y además funciona igual en iOS (que no soporta Background Sync) y
 * en Android.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listPendingSales,
  markSaleFailed,
  markSaleSynced,
  type PendingSale,
} from "@/lib/offline/queue";
import { completeSale } from "../services/pos-service";

export interface SaleSyncState {
  pendingCount: number;
  failedCount: number;
  syncing: boolean;
  /** La sesión caducó estando offline: hay que volver a entrar para subir. */
  needsReauth: boolean;
  /** Fecha (ISO) de la venta sin subir más antigua. Alimenta la urgencia. */
  oldestPendingAt: string | null;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

/**
 * `navigator.onLine` miente: devuelve `true` estando conectado a un WiFi sin
 * salida a internet, que es justo lo que pasa en un local con el módem caído.
 * Antes de vaciar la cola se confirma con una petición real y barata.
 */
async function hasRealConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Archivo estático propio: no gasta cuota de Supabase y esquiva el caché.
    await fetch(`/icons/icon-192.png?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function useSaleSync(tenantId: string | null): SaleSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [oldestPendingAt, setOldestPendingAt] = useState<string | null>(null);
  // Evita que dos disparadores (evento `online` + volver a la pestaña) suban
  // la misma venta a la vez.
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    try {
      const pending = await listPendingSales(tenantId);
      setPendingCount(pending.filter((s) => s.status === "pending").length);
      setFailedCount(pending.filter((s) => s.status === "failed").length);
      // La lista ya viene ordenada por fecha de venta, así que la primera es
      // la más antigua: es la que determina cuánta urgencia hay.
      setOldestPendingAt(pending[0]?.createdAt ?? null);
    } catch (error) {
      console.error("[pos-sync] no se pudo leer la cola:", error);
    }
  }, [tenantId]);

  const syncNow = useCallback(async () => {
    if (!tenantId || runningRef.current) return;

    const queue = await listPendingSales(tenantId);
    const pending = queue.filter((s) => s.status === "pending");
    if (pending.length === 0) {
      await refresh();
      return;
    }

    if (!(await hasRealConnectivity())) return;

    runningRef.current = true;
    setSyncing(true);

    try {
      // Refrescar la sesión ANTES de empezar: si el cajero estuvo horas sin
      // red, el access token está caducado y todas las ventas fallarían con
      // 401, gastando un intento cada una.
      const supabase = createSupabaseBrowserClient();
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !data.session) {
        // No se descarta NADA: la cola queda intacta esperando a que el
        // usuario vuelva a iniciar sesión.
        setNeedsReauth(true);
        return;
      }
      setNeedsReauth(false);

      // Secuencial y en orden de venta. Nada de Promise.all: cada venta
      // descuenta stock y el orden del histórico debe corresponder con lo que
      // pasó en el mostrador.
      for (const sale of pending) {
        try {
          await uploadSale(sale);
          // Solo aquí se borra de la cola: el servidor la confirmó.
          await markSaleSynced(sale.idempotencyKey);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await markSaleFailed(sale.idempotencyKey, message);
          console.error(
            `[pos-sync] falló la venta ${sale.idempotencyKey}:`,
            message
          );
          // Se corta en seco: si el servidor está rechazando, insistir con las
          // siguientes solo quema reintentos. Se retoma en el próximo disparo.
          break;
        }
      }
    } finally {
      runningRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [tenantId, refresh]);

  useEffect(() => {
    if (!tenantId) return;

    // Diferido a propósito: llamar a estos setState de forma síncrona dentro
    // del efecto encadena renders (react-hooks/set-state-in-effect). Mismo
    // patrón que ya usan use-pos-catalog.ts y use-online-status.ts.
    const timeout = window.setTimeout(() => {
      void refresh();
      void syncNow();
    }, 0);

    const onOnline = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tenantId, refresh, syncNow]);

  return {
    pendingCount,
    failedCount,
    syncing,
    needsReauth,
    oldestPendingAt,
    refresh,
    syncNow,
  };
}

async function uploadSale(sale: PendingSale): Promise<void> {
  await completeSale({
    tenantId: sale.tenantId,
    userId: sale.userId,
    clienteId: sale.clienteId,
    metodoPago: sale.metodoPago,
    items: sale.items,
    includeIva: sale.includeIva,
    notas: sale.notas ?? undefined,
    montoRecibido: sale.montoRecibido,
    idempotencyKey: sale.idempotencyKey,
    fechaVenta: sale.createdAt,
    cajaId: sale.cajaId,
    totalCobrado: sale.totalCobrado,
    origen: "offline",
  });
}
