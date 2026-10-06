"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  contarNoLeidas,
  fusionarNotificacion,
  hayCorreoDeStockPendiente,
  type Notificacion,
} from "@/lib/notificaciones";

const LIMITE = 30;
const COLUMNAS = "id, tipo, titulo, mensaje, enlace, creado_en, correo_enviado_en";
/** Entre dos peticiones del correo de stock desde esta pestaña. */
const PAUSA_CORREO_MS = 20_000;
/** Recuperar el foco no vuelve a consultar si la última carga es más reciente. */
const PAUSA_FOCO_MS = 30_000;

/**
 * Notificaciones de la campana (migración 108).
 *
 * - Carga las 30 más recientes que la RLS deja ver a este usuario (stock para
 *   todos; acciones de colaboradores según permisos).
 * - Se entera al instante por Realtime (INSERT y UPDATE: las agrupadas llegan
 *   como UPDATE con el mismo id) y vuelve a consultar al recuperar el foco, por
 *   si el socket se cayó.
 * - Si ve un aviso de stock con el correo pendiente, pide el envío
 *   (`/api/notificaciones/correo-stock`). La base decide si toca y evita
 *   duplicados; si responde "esperar", se reintenta pasado ese tiempo.
 */
export function useNotificaciones() {
  const { tenantId, userId } = useTenantContext();
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [leidoHasta, setLeidoHasta] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Sube cuando vence la espera del correo de stock: vuelve a disparar el efecto.
  const [turnoCorreo, setTurnoCorreo] = useState(0);

  const ultimaCarga = useRef(0);
  const ultimoCorreo = useRef(0);
  const reintentoCorreo = useRef<number | null>(null);

  const cargar = useCallback(async () => {
    if (!tenantId || !userId) {
      setCargando(false);
      return;
    }
    ultimaCarga.current = Date.now();
    try {
      const supabase = createSupabaseBrowserClient();
      const [{ data, error }, { data: lectura }] = await Promise.all([
        supabase
          .from("notificaciones")
          .select(COLUMNAS)
          .eq("tenant_id", tenantId)
          .order("creado_en", { ascending: false })
          .limit(LIMITE),
        supabase
          .from("notificaciones_lectura")
          .select("leido_hasta")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
      ]);
      if (error) {
        console.error("[notificaciones] no se pudieron cargar:", error.message);
      } else {
        setLista((data ?? []) as Notificacion[]);
      }
      setLeidoHasta((lectura?.leido_hasta as string | undefined) ?? null);
    } catch (err) {
      console.error("[notificaciones] sin red:", err);
    } finally {
      setCargando(false);
    }
  }, [tenantId, userId]);

  const pedirCorreo = useCallback(async () => {
    if (!tenantId || Date.now() - ultimoCorreo.current < PAUSA_CORREO_MS) return;
    ultimoCorreo.current = Date.now();
    try {
      const res = await fetch("/api/notificaciones/correo-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const cuerpo = (await res.json().catch(() => null)) as { esperar?: number } | null;
      if (typeof cuerpo?.esperar === "number") {
        if (reintentoCorreo.current) window.clearTimeout(reintentoCorreo.current);
        reintentoCorreo.current = window.setTimeout(() => {
          reintentoCorreo.current = null;
          ultimoCorreo.current = 0;
          setTurnoCorreo((n) => n + 1);
        }, (cuerpo.esperar + 5) * 1000);
      }
    } catch {
      // Sin red: el cron diario lo recoge.
    }
  }, [tenantId]);

  // Carga inicial y Realtime.
  useEffect(() => {
    if (!tenantId || !userId) return;
    // Diferido, convención del repo (`react-hooks/set-state-in-effect`).
    const inicial = window.setTimeout(() => void cargar(), 0);

    const supabase = createSupabaseBrowserClient();
    const canal = supabase
      .channel(`notificaciones:${tenantId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const fila = payload.new as Notificacion & { actor_id?: string | null };
          // La RLS ya filtra, pero el actor nunca debe verse a sí mismo.
          if (fila.actor_id && fila.actor_id === userId) return;
          setLista((actual) => fusionarNotificacion(actual, fila, LIMITE));
        }
      )
      .subscribe();

    const alEnfocar = () => {
      if (Date.now() - ultimaCarga.current > PAUSA_FOCO_MS) void cargar();
    };
    window.addEventListener("focus", alEnfocar);

    return () => {
      window.clearTimeout(inicial);
      window.removeEventListener("focus", alEnfocar);
      void supabase.removeChannel(canal);
    };
  }, [tenantId, userId, cargar]);

  // Correo de stock pendiente.
  const correoPendiente = hayCorreoDeStockPendiente(lista);
  useEffect(() => {
    if (!correoPendiente) return;
    const t = window.setTimeout(() => void pedirCorreo(), 1500);
    return () => window.clearTimeout(t);
  }, [correoPendiente, pedirCorreo, turnoCorreo]);

  useEffect(
    () => () => {
      if (reintentoCorreo.current) window.clearTimeout(reintentoCorreo.current);
    },
    []
  );

  const marcarLeidas = useCallback(async () => {
    if (!tenantId) return;
    setLeidoHasta(new Date().toISOString());
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("marcar_notificaciones_leidas", {
        p_tenant_id: tenantId,
      });
      if (error) {
        console.error("[notificaciones] no se pudieron marcar como leídas:", error.message);
      } else if (typeof data === "string") {
        setLeidoHasta(data);
      }
    } catch (err) {
      console.error("[notificaciones] sin red:", err);
    }
  }, [tenantId]);

  const noLeidas = useMemo(() => contarNoLeidas(lista, leidoHasta), [lista, leidoHasta]);

  return { lista, leidoHasta, noLeidas, cargando, marcarLeidas, recargar: cargar };
}
