"use client";

import { useCallback, useEffect, useRef } from "react";
import { aE164 } from "@/lib/telefono";

/**
 * Guarda el borrador del registro (`/api/registro/borrador`) al salir de los
 * campos de contacto, con debounce y sin repetir el mismo envio.
 *
 * No hace nada hasta que hay nombre, negocio y un celular valido: es lo minimo
 * para poder escribirle a quien no termino. Nunca bloquea ni avisa de errores:
 * es un seguimiento, no parte del alta.
 */

export interface DatosBorrador {
  nombre: string;
  negocio: string;
  pais: string;
  telefono: string;
  email: string;
  /** Campo trampa: una persona lo deja vacio. */
  sitioWeb: string;
}

const ESPERA_MS = 600;

export function useBorradorRegistro() {
  const ultimo = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useCallback((datos: DatosBorrador) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!aE164(datos.pais, datos.telefono)) return;
      if (!datos.nombre.trim() || datos.negocio.trim().length < 2) return;

      const cuerpo = JSON.stringify({
        pais: datos.pais,
        telefono: datos.telefono,
        nombre: datos.nombre.trim(),
        negocio: datos.negocio.trim(),
        email: datos.email.trim() || undefined,
        sitio_web: datos.sitioWeb || undefined,
      });
      if (cuerpo === ultimo.current) return;
      ultimo.current = cuerpo;

      void fetch("/api/registro/borrador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        keepalive: true,
      }).catch(() => {});
    }, ESPERA_MS);
  }, []);
}
