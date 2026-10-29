"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mensajeErrorCatalogo, obtenerVistaPrevia, obtenerVistaPreviaProductos } from "../catalogo-service";
import type { CatalogoEncabezado, CatalogoPagina } from "../types";
import { CatalogoVista, type FuenteCatalogo } from "./catalogo-vista";

const fuentePrevia: FuenteCatalogo = async (busqueda, categoria, offset) => {
  try {
    return await obtenerVistaPreviaProductos(busqueda, categoria, offset);
  } catch (error) {
    return { error: mensajeErrorCatalogo(error) };
  }
};

/**
 * El catálogo tal como lo ve el cliente, dentro de un marco de celular, aunque
 * todavía esté apagado. Lee lo GUARDADO: lo que se edita en «Personalizar»
 * aparece aquí después de guardarlo.
 *
 * El marco lleva `transform`: así lo `fixed` de la página (barra del pedido y
 * hojas) queda dentro del marco y no encima del panel.
 */
export function VistaPreviaCatalogo() {
  const [datos, setDatos] = useState<{ encabezado: CatalogoEncabezado; pagina: CatalogoPagina } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const [encabezado, pagina] = await Promise.all([obtenerVistaPrevia(), obtenerVistaPreviaProductos("", null, 0)]);
        if (!vigente) return;
        if (!encabezado) setError("No se encontró tu negocio.");
        else setDatos({ encabezado, pagina });
      } catch (e) {
        if (vigente) setError(mensajeErrorCatalogo(e));
      }
    })();
    return () => {
      vigente = false;
    };
  }, [version]);

  if (error) return <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>;
  if (!datos) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {datos.encabezado.activo
            ? "Así lo ven tus clientes ahora."
            : "Tu catálogo está apagado: así se verá cuando lo publiques."}{" "}
          El botón de WhatsApp no envía nada aquí.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setDatos(null);
            setVersion((v) => v + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>
      <div
        className="mx-auto h-[min(760px,75dvh)] w-full max-w-[400px] overflow-hidden rounded-[2rem] border-8 border-foreground/80 bg-slate-50 shadow-xl"
        style={{ transform: "translateZ(0)" }}
      >
        <div className="h-full overflow-y-auto overscroll-contain">
          <CatalogoVista
            key={version}
            encabezado={datos.encabezado}
            paginaInicial={datos.pagina}
            fuente={fuentePrevia}
            vistaPrevia
          />
        </div>
      </div>
    </div>
  );
}
