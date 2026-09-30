"use client";

/**
 * Ventana de confirmacion para acciones que no se deshacen (eliminar,
 * devolver una compra, revocar una clave...). Se usa como una promesa:
 *
 *   const confirmar = useConfirmar();
 *   if (!(await confirmar({ titulo: "¿Eliminar Café molido?" }))) return;
 *
 * Una sola ventana para todo el panel (`ConfirmarProvider` en el shell del
 * dashboard), asi cada boton no carga su propio dialogo.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface OpcionesConfirmar {
  titulo: string;
  descripcion?: string;
  /** Texto del boton de confirmar. Por defecto "Eliminar". */
  accion?: string;
  /** `peligro` (rojo, por defecto) para borrar; `aviso` (naranja) para devolver o cancelar. */
  tono?: "peligro" | "aviso";
}

type Confirmar = (opciones: OpcionesConfirmar) => Promise<boolean>;

const ConfirmarContext = createContext<Confirmar | null>(null);

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<((si: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>((nuevas) => {
    // Si ya habia una abierta (no deberia), se da por cancelada.
    resolver.current?.(false);
    setOpciones(nuevas);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cerrar = (si: boolean) => {
    resolver.current?.(si);
    resolver.current = null;
    setOpciones(null);
  };

  const aviso = opciones?.tono === "aviso";

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <Dialog open={opciones !== null} onOpenChange={(abierto) => !abierto && cerrar(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div
              className={`mb-1 flex h-9 w-9 items-center justify-center rounded-full ${
                aviso ? "bg-orange-500/15 text-orange-500" : "bg-red-500/15 text-red-500"
              }`}
              aria-hidden="true"
            >
              {aviso ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </div>
            <DialogTitle className="text-base">{opciones?.titulo}</DialogTitle>
            <DialogDescription className="text-sm">
              {opciones?.descripcion ?? "Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className={`h-9 text-white ${
                aviso ? "bg-orange-500 hover:bg-orange-600" : "bg-red-600 hover:bg-red-700"
              }`}
              onClick={() => cerrar(true)}
              autoFocus
            >
              {opciones?.accion ?? "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmarContext.Provider>
  );
}

/**
 * La funcion para pedir confirmacion. Fuera del proveedor (no deberia pasar
 * en el panel) cae al `confirm` del navegador: nunca borra sin preguntar.
 */
export function useConfirmar(): Confirmar {
  const contexto = useContext(ConfirmarContext);
  return (
    contexto ??
    (async ({ titulo, descripcion }) =>
      typeof window !== "undefined" &&
      window.confirm([titulo, descripcion].filter(Boolean).join("\n")))
  );
}
