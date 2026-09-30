"use client";

/**
 * Indicador de la impresora de tickets en la barra del POS: dice si esta
 * lista y abre la configuracion (`ImpresoraDialog`).
 */

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpresora } from "../impresora/use-impresora";
import { ImpresoraDialog } from "./impresora-dialog";

export function BotonImpresora() {
  const [abierto, setAbierto] = useState(false);
  const { config, estado } = useImpresora();

  const punto =
    estado === "lista"
      ? "bg-emerald-500"
      : estado === "conectando"
        ? "bg-amber-500 animate-pulse"
        : estado === "error"
          ? "bg-red-500"
          : "bg-muted-foreground/40";

  return (
    <>
      <Button
        variant="outline"
        className="h-9 shrink-0 gap-2 text-xs"
        onClick={() => setAbierto(true)}
        title="Impresora de tickets"
      >
        <span className="relative">
          <Printer className="h-4 w-4" />
          {config && (
            <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${punto}`} aria-hidden="true" />
          )}
        </span>
        {config ? (estado === "lista" ? "Impresora lista" : "Impresora") : "Conectar impresora"}
      </Button>
      <ImpresoraDialog open={abierto} onOpenChange={setAbierto} />
    </>
  );
}
