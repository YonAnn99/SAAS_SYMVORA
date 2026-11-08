"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  codigo: string;
  oscura?: boolean;
}

/** iPhone/iPad (incluido el iPad que se anuncia como Mac): ahi no hay Google Wallet. */
function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * «Agregar a la Billetera de Google» de la tarjeta publica. Pide el enlace
 * firmado a `/api/tarjeta/[codigo]/google-wallet` y abre la pagina de Google.
 *
 * El dibujo es el badge OFICIAL de Google en español de Latinoamerica
 * (`public/google-wallet/agregar-a-google-wallet.svg`, del paquete «es419» de
 * sus reglas de marca). No se recolorea, recorta ni se le cambia el texto: lo
 * exigen esas reglas para aprobar el acceso de publicacion.
 */
const sinSuscripcion = () => () => {};

export function BotonGoogleWallet({ codigo, oscura = false }: Props) {
  // En el servidor no se sabe el dispositivo: se pinta hasta hidratar.
  const visible = useSyncExternalStore(sinSuscripcion, () => !esIos(), () => false);
  const [cargando, setCargando] = useState(false);

  if (!visible) return null;

  const guardar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/tarjeta/${encodeURIComponent(codigo)}/google-wallet`);
      const datos = (await res.json().catch(() => ({}))) as { saveUrl?: string };
      if (!res.ok || !datos.saveUrl) throw new Error(`HTTP ${res.status}`);
      window.location.href = datos.saveUrl;
    } catch (error) {
      console.error("[google-wallet] enlace:", error);
      toast.error("No se pudo preparar tu tarjeta para Google Wallet. Intenta de nuevo.");
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={guardar}
        disabled={cargando}
        aria-label="Agregar a la Billetera de Google"
        aria-busy={cargando}
        className="relative inline-flex rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG oficial tal cual; next/image no aporta nada aqui */}
        <img
          src="/google-wallet/agregar-a-google-wallet.svg"
          alt=""
          width={239}
          height={55}
          className="h-12 w-auto"
        />
        {cargando && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
          </span>
        )}
      </button>
      <span className={`text-xs ${oscura ? "text-slate-400" : "text-slate-500"}`}>
        Llévala en tu teléfono y mira tus sellos al instante
      </span>
    </div>
  );
}
