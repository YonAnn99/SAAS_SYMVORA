"use client";

import { useEffect } from "react";

/**
 * Guarda el aviso de «se puede instalar» del navegador (`beforeinstallprompt`,
 * Chrome/Edge). Llega UNA vez al cargar la pagina, asi que se captura desde el
 * layout raiz y no desde la pagina que pinta el boton, que podria montarse
 * despues. Lo usa `useInstalarApp`.
 */

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let evento: EventoInstalacion | null = null;
let instaladaAhora = false;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((o) => o());
}

export function suscribirInstalacion(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function hayEventoInstalacion(): boolean {
  return evento !== null;
}

export function seInstaloAhora(): boolean {
  return instaladaAhora;
}

/** Abre el dialogo del navegador. `true` si la persona acepto. */
export async function pedirInstalacion(): Promise<boolean> {
  if (!evento) return false;
  const e = evento;
  // El evento sirve una sola vez.
  evento = null;
  avisar();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}

export function CapturaInstalacion() {
  useEffect(() => {
    const alPoder = (e: Event) => {
      e.preventDefault();
      evento = e as EventoInstalacion;
      avisar();
    };
    const alInstalar = () => {
      evento = null;
      instaladaAhora = true;
      avisar();
    };
    window.addEventListener("beforeinstallprompt", alPoder);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoder);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);
  return null;
}
