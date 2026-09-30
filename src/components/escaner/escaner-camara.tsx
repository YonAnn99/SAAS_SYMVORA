"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CameraOff, Check, Flashlight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { crearDetector, faltaHttps } from "@/lib/escaner/detector";
import { pitidoError, pitidoOk, prepararPitido } from "@/lib/escaner/pitido";
import { crearFiltroRepetidos } from "@/lib/escaner/repetidos";

/**
 * Lo que responde quien recibe el codigo, en modo continuo:
 *   ok     se uso (bip agudo, cuenta uno mas)
 *   error  no sirve: no existe, sin stock... (bip grave, sigue abierto)
 *   salir  hace falta otra ventana (elegir variante, capturar kilos): se cierra
 */
export interface ResultadoEscaneo {
  tipo: "ok" | "error" | "salir";
  mensaje: string;
}

export type ModoEscaner = "continuo" | "uno";

interface EscanerCamaraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: ModoEscaner;
  titulo?: string;
  /** Cada codigo leido. En modo "uno" el escaner se cierra despues. */
  onCodigo: (codigo: string) => ResultadoEscaneo | void;
}

/** Lecturas por segundo: suficiente para sentirse inmediato sin calentar el celular. */
const INTERVALO_MS = 150;

export function EscanerCamara({ open, onOpenChange, modo, titulo, onCodigo }: EscanerCamaraProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo ?? "Escanear código"}</DialogTitle>
          <DialogDescription>
            {modo === "continuo"
              ? "Apunta a cada código; se agregan solos con un bip."
              : "Apunta la cámara al código de barras."}
          </DialogDescription>
        </DialogHeader>
        {/* Montado solo abierto: cada apertura empieza limpia y, al cerrar, el
            desmontaje apaga la camara. */}
        {open && <Visor modo={modo} onCodigo={onCodigo} cerrar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type Estado = { tipo: "iniciando" } | { tipo: "activo" } | { tipo: "error"; mensaje: string };

function mensajeDeError(e: unknown): string {
  if (faltaHttps()) {
    return "La cámara solo funciona en páginas seguras (HTTPS). Abre SYMVORA desde su dirección https.";
  }
  const nombre = e instanceof DOMException ? e.name : "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "No hay permiso para usar la cámara. Actívalo en el candado de la barra de direcciones (o en los ajustes del navegador) y vuelve a abrir el escáner.";
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "No se encontró una cámara en este equipo.";
  }
  if (nombre === "NotReadableError") {
    return "La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentar.";
  }
  return "No se pudo abrir la cámara.";
}

function Visor({
  modo,
  onCodigo,
  cerrar,
}: {
  modo: ModoEscaner;
  onCodigo: EscanerCamaraProps["onCodigo"];
  cerrar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pistaRef = useRef<MediaStreamTrack | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "iniciando" });
  const [linterna, setLinterna] = useState<{ disponible: boolean; encendida: boolean }>({
    disponible: false,
    encendida: false,
  });
  const [aviso, setAviso] = useState<{ id: number; tipo: "ok" | "error"; mensaje: string } | null>(
    null
  );
  const [agregados, setAgregados] = useState(0);

  // Lo ultimo de las props sin reiniciar la camara cada render.
  const onCodigoRef = useRef(onCodigo);
  const cerrarRef = useRef(cerrar);
  useLayoutEffect(() => {
    onCodigoRef.current = onCodigo;
    cerrarRef.current = cerrar;
  });

  useEffect(() => {
    let vivo = true;
    let flujo: MediaStream | null = null;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let quitarAviso: ReturnType<typeof setTimeout> | null = null;
    const pasa = crearFiltroRepetidos();
    prepararPitido();

    const usar = (codigo: string) => {
      if (modo === "uno") {
        pitidoOk();
        onCodigoRef.current(codigo);
        cerrarRef.current();
        return false;
      }
      const r = onCodigoRef.current(codigo);
      if (!r) return true;
      if (r.tipo === "salir") {
        pitidoOk();
        cerrarRef.current();
        return false;
      }
      if (r.tipo === "ok") {
        pitidoOk();
        setAgregados((n) => n + 1);
      } else {
        pitidoError();
      }
      setAviso({ id: Date.now(), tipo: r.tipo, mensaje: r.mensaje });
      if (quitarAviso) clearTimeout(quitarAviso);
      quitarAviso = setTimeout(() => vivo && setAviso(null), 2200);
      return true;
    };

    (async () => {
      try {
        const [detector, stream] = await Promise.all([
          crearDetector(),
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          }),
        ]);
        if (!vivo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        flujo = stream;
        const pista = stream.getVideoTracks()[0] ?? null;
        pistaRef.current = pista;
        const capacidades = (pista?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setLinterna({ disponible: Boolean(capacidades.torch), encendida: false });

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setEstado({ tipo: "activo" });

        const leer = async () => {
          if (!vivo) return;
          let seguir = true;
          if (video.readyState >= 2) {
            try {
              const codigos = await detector.detect(video);
              const codigo = codigos.map((c) => c.rawValue.trim()).find(Boolean);
              if (vivo && codigo && pasa(codigo)) seguir = usar(codigo);
            } catch {
              // Un cuadro que no se pudo leer: se intenta con el siguiente.
            }
          }
          if (vivo && seguir) temporizador = setTimeout(leer, INTERVALO_MS);
        };
        void leer();
      } catch (e) {
        if (vivo) setEstado({ tipo: "error", mensaje: mensajeDeError(e) });
      }
    })();

    return () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
      if (quitarAviso) clearTimeout(quitarAviso);
      // Sin esto la luz de la camara se queda encendida.
      flujo?.getTracks().forEach((t) => t.stop());
      pistaRef.current = null;
    };
  }, [modo]);

  const alternarLinterna = async () => {
    const pista = pistaRef.current;
    if (!pista) return;
    const encendida = !linterna.encendida;
    try {
      await pista.applyConstraints({ advanced: [{ torch: encendida } as MediaTrackConstraintSet] });
      setLinterna((l) => ({ ...l, encendida }));
    } catch {
      setLinterna((l) => ({ ...l, disponible: false }));
    }
  };

  if (estado.tipo === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <CameraOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{estado.mensaje}</p>
        <Button variant="outline" size="sm" onClick={cerrar}>
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          // iPhone: sin `playsInline` el video se abre a pantalla completa.
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />

        {estado.tipo === "iniciando" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Abriendo cámara…</span>
          </div>
        )}

        {estado.tipo === "activo" && (
          <>
            {/* Marco guia y linea de lectura. */}
            <div className="pointer-events-none absolute inset-x-[10%] top-[26%] bottom-[26%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none absolute inset-x-[13%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/90" />
          </>
        )}

        {aviso && (
          <div
            key={aviso.id}
            role="status"
            className={cn(
              "absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-lg animate-fade-in-up",
              aviso.tipo === "ok" ? "bg-emerald-600/95" : "bg-red-600/95"
            )}
          >
            {aviso.tipo === "ok" ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <X className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{aviso.mensaje}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {linterna.disponible ? (
          <Button
            variant={linterna.encendida ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={alternarLinterna}
          >
            <Flashlight className="mr-1.5 h-3.5 w-3.5" />
            Linterna
          </Button>
        ) : (
          <span />
        )}
        {modo === "continuo" && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {agregados === 1 ? "1 agregado" : `${agregados} agregados`}
            </span>
            <Button size="sm" className="h-8" onClick={cerrar}>
              Listo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
