"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTutorialContext } from "@/components/tutorial/tutorial-provider";
import { stripLocale } from "@/lib/navigation";
import type { Novedad } from "@/lib/novedades";
import { useNovedades } from "./use-novedades";

/** Espera tras cargar: que primero se vea la pantalla y luego la novedad. */
const ESPERA_MS = 1500;

/**
 * Ventana de novedad (`lib/novedades.ts`): sale UNA vez por persona, a quien
 * puede abrir el módulo. «Conocerlo» lleva al módulo y la marca como vista;
 * «Después» la cierra para siempre, pero la etiqueta «Nuevo» del menú sigue
 * hasta su fecha.
 *
 * No interrumpe:
 * - el tutorial (en curso o minimizado): un negocio recién creado lo ve primero;
 * - una venta: en el POS no sale;
 * - a quien ya está en el módulo, que cuenta como vista.
 *
 * En celular, `DialogContent` ya la convierte en hoja inferior.
 */
export function VentanaNovedad() {
  const { porMostrar, marcarVista, descartar } = useNovedades();
  const { isActive, minimized } = useTutorialContext();
  const ruta = stripLocale(usePathname());
  const router = useRouter();
  // Se fija al abrir: aunque cambie la ruta o el estado, la ventana no salta.
  const [abierta, setAbierta] = useState<Novedad | null>(null);

  const puede = Boolean(porMostrar) && !isActive && !minimized && ruta !== "/pos" && ruta !== porMostrar?.href;

  useEffect(() => {
    if (!puede || abierta || !porMostrar) return;
    const t = window.setTimeout(() => setAbierta(porMostrar), ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [puede, abierta, porMostrar]);

  if (!abierta) return null;

  const cerrar = () => {
    descartar(abierta.id);
    setAbierta(null);
  };

  const conocer = () => {
    marcarVista(abierta.id);
    setAbierta(null);
    router.push(abierta.href);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <IlustracionCatalogo />
        <div className="space-y-3 p-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" aria-hidden />
            Novedad en SYMVORA
          </span>
          <DialogTitle className="text-lg font-semibold leading-tight">{abierta.titulo}</DialogTitle>
          <DialogDescription>{abierta.texto}</DialogDescription>
          <ul className="space-y-2 pt-1">
            {abierta.puntos.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="mx-0 mb-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={cerrar}>
            Después
          </Button>
          <Button onClick={conocer}>{abierta.boton}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Un teléfono con el catálogo y la burbuja del pedido por WhatsApp, en HTML y
 * CSS: sin imágenes que descargar. Decorativo.
 */
function IlustracionCatalogo() {
  return (
    <div
      aria-hidden
      className="relative flex h-40 items-end justify-center overflow-hidden bg-gradient-to-br from-primary/90 to-[var(--nav-bg)]"
    >
      <div className="relative h-36 w-28 translate-y-3 rounded-t-[18px] border-4 border-b-0 border-white/90 bg-white p-2 shadow-xl motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-500 dark:bg-zinc-900">
        <div className="mb-1.5 h-2 w-12 rounded-full bg-primary/70" />
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
              <div className="mb-1 h-6 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-1 w-8 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <div className="mt-0.5 h-1 w-5 rounded-full bg-primary/60" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute right-[calc(50%-6.5rem)] top-6 rounded-2xl rounded-bl-sm bg-[#25D366] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:fade-in motion-safe:delay-300 motion-safe:duration-300 motion-safe:fill-mode-backwards">
        ¡Nuevo pedido!
      </div>
    </div>
  );
}
