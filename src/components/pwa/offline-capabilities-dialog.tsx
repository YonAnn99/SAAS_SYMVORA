"use client";

/**
 * Explica de una vez qué se puede y qué no se puede hacer sin internet.
 *
 * Aparece la primera vez que la app se detecta corriendo como PWA instalada
 * (pantalla de inicio), que es cuando alguien puede razonablemente creer que
 * "ya funciona todo sin conexión". Aclararlo antes evita el escenario malo:
 * un cajero que da por hecho que puede vender a crédito sin red y descubre
 * que no a mitad de una venta, con el cliente delante.
 *
 * Se puede cerrar y no vuelve a salir (queda la entrada del menú para
 * consultarlo cuando haga falta).
 */

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Clock, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isStandalonePwa } from "@/lib/offline/persist";
import {
  OFFLINE_AVAILABLE,
  OFFLINE_UNAVAILABLE,
} from "@/lib/offline/capabilities";

const SEEN_KEY = "symvora_offline_intro_seen";

export function OfflineCapabilitiesDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Solo en PWA instalada: en una pestaña normal el mensaje sobra y sería
    // ruido para quien entra desde la computadora del mostrador.
    if (!isStandalonePwa()) return;
    try {
      if (window.localStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      // Sin localStorage (modo privado) preferimos no insistir cada arranque.
      return;
    }
    // Diferido: abrir el diálogo de forma síncrona dentro del efecto encadena
    // renders (react-hooks/set-state-in-effect). Además da un respiro antes de
    // tapar la pantalla nada más entrar.
    const timeout = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Da igual: lo peor que pasa es que vuelva a salir.
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-primary" />
            Cómo funciona SYMVORA sin internet
          </DialogTitle>
          <DialogDescription>
            Puedes seguir cobrando aunque se caiga la conexión. Esto es lo que
            conviene saber antes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="mb-2 font-medium text-emerald-700 dark:text-emerald-400">
              Sí funciona sin conexión
            </h3>
            <ul className="space-y-1.5">
              {OFFLINE_AVAILABLE.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-medium text-red-700 dark:text-red-400">
              No funciona sin conexión
            </h3>
            <ul className="space-y-1.5">
              {OFFLINE_UNAVAILABLE.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <span>
                    {item.label}
                    {item.reason && (
                      <span className="text-muted-foreground"> — {item.reason}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <h3 className="mb-1 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
              <Clock className="h-4 w-4 shrink-0" />
              No te quedes días sin conectarte
            </h3>
            <p className="text-amber-900/90 dark:text-amber-200/90">
              Las ventas que hagas sin internet se guardan <strong>solo en este
              dispositivo</strong> hasta que vuelva la conexión. Si pasan varios
              días, el teléfono puede borrarlas por su cuenta para liberar
              espacio, y esas ventas se perderían.
            </p>
            <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
              Conéctate a WiFi o datos <strong>al menos una vez al día</strong>.
              La subida es automática y toma unos segundos.
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button onClick={dismiss} className="w-full sm:w-auto">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
