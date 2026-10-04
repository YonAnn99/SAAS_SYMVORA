"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logActivity } from "@/lib/supabase/activity-logger";
import { mensajeDeError } from "@/features/inventory/error-message";
import { fetchArchivedProducts, restoreProduct } from "../../services/product-service";
import type { Producto } from "../../types/inventory.types";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

/**
 * Productos archivados (migracion 102): los que tenian historial y no se
 * podian borrar. Un boton discreto "Archivados (N)" bajo el catalogo, solo si
 * hay alguno, abre la lista para restaurarlos.
 *
 * `version` cambia cuando el catalogo cambia (p. ej. al archivar uno): se
 * vuelve a consultar para que el conteo no quede atrasado.
 */
export function ProductosArchivados({
  tenantId,
  version,
  onRestaurado,
}: {
  tenantId: string;
  version: number;
  onRestaurado: () => void;
}) {
  const [archivados, setArchivados] = useState<Producto[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setArchivados(await fetchArchivedProducts(tenantId));
    } catch {
      // Sin la lista no se ofrece el boton; el catalogo sigue funcionando.
      setArchivados([]);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;
    void fetchArchivedProducts(tenantId)
      .then((lista) => {
        if (!cancelado) setArchivados(lista);
      })
      .catch(() => {
        if (!cancelado) setArchivados([]);
      });
    return () => {
      cancelado = true;
    };
  }, [tenantId, version]);

  const restaurar = async (producto: Producto) => {
    setRestaurando(producto.id);
    try {
      await restoreProduct(producto.id);
      await logActivity({
        action: "UPDATE",
        entity: "producto",
        entityId: producto.id,
        entityName: producto.nombre,
        details: { restaurado: true },
      });
      toast.success(`«${producto.nombre}» vuelve al catálogo`);
      await cargar();
      onRestaurado();
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setRestaurando(null);
    }
  };

  if (archivados.length === 0) return null;

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setAbierto(true)}
        >
          <Archive className="h-3.5 w-3.5" />
          Archivados ({archivados.length})
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Productos archivados</DialogTitle>
            <DialogDescription className="text-xs">
              No aparecen en el catálogo ni en el punto de venta, pero sus ventas y reportes se conservan.
              Restaura el que quieras volver a vender.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {archivados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.codigo_barras, `Archivado el ${fecha(p.archivado_en)}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 text-xs"
                  disabled={restaurando === p.id}
                  onClick={() => void restaurar(p)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restaurando === p.id ? "Restaurando…" : "Restaurar"}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
