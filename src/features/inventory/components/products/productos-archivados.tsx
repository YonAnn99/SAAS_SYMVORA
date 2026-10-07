"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Archive, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logActivity } from "@/lib/supabase/activity-logger";
import { getInitials } from "@/lib/utils";
import { mensajeDeError } from "@/features/inventory/error-message";
import { fetchArchivedProducts, restoreProduct } from "../../services/product-service";
import type { Producto } from "../../types/inventory.types";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

function Miniatura({ producto }: { producto: Producto }) {
  return producto.imagen_url ? (
    <Image
      src={producto.imagen_url}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
      {getInitials(producto.nombre)}
    </div>
  );
}

/**
 * Pestaña "Archivados" de Productos (migracion 102). Archivar deja el producto
 * en `productos` con `archivado_en`: sale del catalogo, del POS y de los
 * selectores, y su historial se conserva. Restaurar lo devuelve a todos.
 *
 * `version` sube cuando se archiva uno desde el catalogo: se vuelve a consultar.
 */
export function ProductosArchivadosSeccion({
  tenantId,
  version,
  onRestaurado,
}: {
  tenantId: string;
  version: number;
  onRestaurado: () => void;
}) {
  const [archivados, setArchivados] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setArchivados(await fetchArchivedProducts(tenantId));
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;
    void fetchArchivedProducts(tenantId)
      .then((lista) => {
        if (!cancelado) setArchivados(lista);
      })
      .catch((error) => {
        if (!cancelado) toast.error(mensajeDeError(error));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tenantId, version]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return archivados;
    return archivados.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo_barras?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [archivados, busqueda]);

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
      toast.success(`«${producto.nombre}» vuelve al catálogo y al punto de venta`);
      await cargar();
      onRestaurado();
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setRestaurando(null);
    }
  };

  const botonRestaurar = (p: Producto) => (
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
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, código o SKU..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <Card className="animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">Productos archivados</CardTitle>
            <span className="font-mono text-xs text-muted-foreground">
              {archivados.length} {archivados.length === 1 ? "producto" : "productos"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            No aparecen en el catálogo ni en el punto de venta, pero sus ventas y reportes se conservan.
            Restaura el que quieras volver a vender.
          </p>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Archive className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {archivados.length === 0
                  ? "No tienes productos archivados"
                  : "No se encontraron productos archivados"}
              </p>
            </div>
          ) : (
            <>
              {/* Celular: una fila por producto con su boton visible. */}
              <ul className="divide-y divide-border md:hidden">
                {filtrados.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Miniatura producto={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.codigo_barras, `Archivado el ${fecha(p.archivado_en)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {botonRestaurar(p)}
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider">Producto</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Código</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">
                        Precio de venta
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Archivado</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Miniatura producto={p} />
                            <span className="text-sm font-medium">{p.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.codigo_barras || p.sku || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          ${p.precio_venta.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fecha(p.archivado_en)}
                        </TableCell>
                        <TableCell className="text-right">{botonRestaurar(p)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
