"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { camaraDisponible, faltaHttps } from "@/lib/escaner/detector";
import { EscanerCamara, type ModoEscaner, type ResultadoEscaneo } from "./escaner-camara";

// --- ¿Hay camara? ------------------------------------------------------------
// `enumerateDevices` dice si existe alguna camara SIN pedir permiso (solo los
// tipos, sin nombres). Se consulta una vez por pagina y se comparte.

let hayCamara: boolean | null = null;
let consultando = false;
const oyentes = new Set<() => void>();

function consultarCamara() {
  if (consultando || hayCamara !== null) return;
  consultando = true;
  // Sin HTTPS no hay `mediaDevices`: se muestra el boton igual para que el
  // escaner explique por que no abre (pasa al probar con la IP de la PC).
  if (faltaHttps()) {
    hayCamara = true;
    oyentes.forEach((o) => o());
    return;
  }
  if (!camaraDisponible()) {
    hayCamara = false;
    oyentes.forEach((o) => o());
    return;
  }
  navigator.mediaDevices
    .enumerateDevices()
    .then((ds) => ds.some((d) => d.kind === "videoinput"))
    .catch(() => true)
    .then((si) => {
      hayCamara = si;
      oyentes.forEach((o) => o());
    });
}

function useHayCamara(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      consultarCamara();
      return () => oyentes.delete(avisar);
    },
    () => hayCamara === true,
    () => false
  );
}

// --- Boton -------------------------------------------------------------------

interface BotonEscanearProps {
  modo: ModoEscaner;
  titulo?: string;
  onCodigo: (codigo: string) => ResultadoEscaneo | void;
  /**
   * `dentro`: icono sin borde para ir dentro de un campo de texto, a la
   * derecha (el campo necesita `pr-9` y un contenedor `relative`).
   * `suelto`: boton cuadrado con borde, del alto de los campos `h-8`/`h-9`.
   */
  variante?: "dentro" | "suelto";
  /** Icono del boton; por defecto el de codigo de barras. */
  icono?: ReactNode;
  /** Texto bajo el titulo del escaner (p. ej. "Apunta al QR de la tarjeta"). */
  descripcion?: string;
  className?: string;
}

export function BotonEscanear({
  modo,
  titulo,
  onCodigo,
  variante = "dentro",
  icono,
  descripcion,
  className,
}: BotonEscanearProps) {
  const hay = useHayCamara();
  const [abierto, setAbierto] = useState(false);
  if (!hay) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={titulo ?? "Escanear con la cámara"}
        title={titulo ?? "Escanear con la cámara"}
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
          variante === "dentro"
            ? "absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md hover:bg-muted"
            : "h-8 w-8 shrink-0 rounded-md border border-input bg-transparent hover:bg-muted",
          className
        )}
      >
        {icono ?? <ScanBarcode className="h-4 w-4" />}
      </button>
      <EscanerCamara
        open={abierto}
        onOpenChange={setAbierto}
        modo={modo}
        titulo={titulo}
        descripcion={descripcion}
        onCodigo={onCodigo}
      />
    </>
  );
}

/** Para mostrar u ocultar algo junto al boton (p. ej. el relleno del campo). */
export { useHayCamara };
