"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cambioDeTarjeta, type VistaTarjeta } from "../lealtad";

/** Al volver a la pestaña no se recarga mas de una vez en este lapso. */
const ESPERA_RECARGA_MS = 10_000;
const COLORES_CONFETI = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"];

function leerVista(codigo: string): VistaTarjeta | null {
  try {
    const crudo = window.localStorage.getItem(`symvora-tarjeta:${codigo}`);
    if (!crudo) return null;
    const v = JSON.parse(crudo) as Partial<VistaTarjeta>;
    return typeof v.sellos === "number" && typeof v.canjes === "number" ? { sellos: v.sellos, canjes: v.canjes } : null;
  } catch {
    return null;
  }
}

function guardarVista(codigo: string, vista: VistaTarjeta) {
  try {
    window.localStorage.setItem(`symvora-tarjeta:${codigo}`, JSON.stringify(vista));
  } catch {
    // Sin almacenamiento (modo privado): la tarjeta se ve igual, sin animar.
  }
}

/** Confeti con la animacion nativa del navegador; los pedazos se borran al terminar. */
function lanzarConfeti(acento: string) {
  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");
  capa.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:50";
  document.body.appendChild(capa);
  const colores = [acento, ...COLORES_CONFETI];
  const animaciones: Animation[] = [];
  for (let i = 0; i < 70; i++) {
    const pedazo = document.createElement("span");
    const ancho = 6 + Math.random() * 6;
    pedazo.style.cssText = `position:absolute;top:-16px;left:${Math.random() * 100}%;width:${ancho}px;height:${
      ancho * 0.45
    }px;border-radius:2px;background:${colores[i % colores.length]}`;
    capa.appendChild(pedazo);
    const deriva = (Math.random() - 0.5) * 220;
    animaciones.push(
      pedazo.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${deriva}px, ${window.innerHeight + 40}px) rotate(${(Math.random() - 0.5) * 900}deg)`,
            opacity: 0.9,
          },
        ],
        { duration: 1800 + Math.random() * 1400, delay: Math.random() * 350, easing: "cubic-bezier(.2,.6,.4,1)" }
      )
    );
  }
  void Promise.allSettled(animaciones.map((a) => a.finished)).then(() => capa.remove());
}

/**
 * Envuelve la tarjeta publica (que se pinta en el servidor) para que se sienta
 * viva: recuerda en este celular cuantos sellos vio el cliente la ultima vez y,
 * si hay nuevos, los hace rebotar; al completar la tarjeta, confeti y el aviso
 * del premio salta. Con "reducir movimiento" del sistema solo hay un destello.
 *
 * "Actualizar" (y volver a la pestaña) vuelve a pedir la tarjeta al servidor:
 * en el mostrador, el cliente la ve cambiar al momento de cobrar.
 */
export function TarjetaViva({
  codigo,
  sellos,
  canjes,
  meta,
  acento,
  oscura,
  children,
}: {
  codigo: string;
  sellos: number;
  canjes: number;
  meta: number;
  acento: string;
  oscura: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const ultimaRecarga = useRef(0);
  // La transicion termina cuando llega la tarjeta nueva, cambie o no.
  const [recargando, iniciar] = useTransition();

  useEffect(() => {
    const actual = { sellos, canjes };
    const cambio = cambioDeTarjeta(leerVista(codigo), actual, meta);
    guardarVista(codigo, actual);

    const raiz = ref.current;
    if (!raiz || (cambio.nuevos.length === 0 && !cambio.completa)) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cambio.nuevos.forEach((i, orden) => {
      const sello = raiz.querySelector<HTMLElement>(`[data-sello="${i}"]`);
      if (!sello) return;
      sello.animate(
        reducir
          ? [{ opacity: 0.35 }, { opacity: 1 }]
          : [
              { transform: "scale(0.2)", opacity: 0 },
              { transform: "scale(1.3)", opacity: 1, offset: 0.55 },
              { transform: "scale(0.9)", offset: 0.8 },
              { transform: "scale(1)" },
            ],
        { duration: reducir ? 500 : 650, delay: 250 + orden * 160, easing: "ease-out", fill: "backwards" }
      );
    });

    if (cambio.completa) {
      const espera = 250 + cambio.nuevos.length * 160 + 300;
      const t = window.setTimeout(() => {
        raiz.querySelector<HTMLElement>("[data-premio]")?.animate(
          reducir
            ? [{ opacity: 0.4 }, { opacity: 1 }]
            : [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(0.98)" }, { transform: "scale(1)" }],
          { duration: 700, easing: "ease-out" }
        );
        if (!reducir) lanzarConfeti(acento);
      }, espera);
      return () => window.clearTimeout(t);
    }
  }, [codigo, sellos, canjes, meta, acento]);

  const recargar = () => {
    ultimaRecarga.current = Date.now();
    iniciar(() => router.refresh());
  };

  // De vuelta a la pestaña (p. ej. tras pagar en caja): trae los sellos al dia.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaRecarga.current < ESPERA_RECARGA_MS) return;
      ultimaRecarga.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [router]);

  return (
    <div ref={ref} className="flex w-full flex-col items-center gap-3">
      {children}
      <button
        type="button"
        onClick={recargar}
        disabled={recargando}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
          oscura ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-200"
        }`}
      >
        {recargando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Actualizar mis sellos
      </button>
    </div>
  );
}
