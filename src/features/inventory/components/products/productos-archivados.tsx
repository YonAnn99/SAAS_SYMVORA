"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Archive, Layers, RotateCcw, Search } from "lucide-react";
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
import {
  contarVariantesDeArchivados,
  fetchArchivedVariants,
  restoreVariant,
  type VarianteArchivada,
} from "../../services/variant-service";
import { etiquetaAtributos } from "../../atributos-variante";
import type { Producto } from "../../types/inventory.types";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";

function Miniatura({ producto }: { producto: { nombre: string; imagen_url: string | null } }) {
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
 * Debajo, las variantes archivadas (migracion 110), con el nombre de su
 * producto. Una variante archivada de un producto activo se restaura sola; si
 * su producto tambien esta archivado, vuelve cuando se restaure el producto.
 *
 * `version` sube cuando se archiva algo desde el catalogo: se vuelve a consultar.
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
  const [variantes, setVariantes] = useState<VarianteArchivada[]>([]);
  // Variantes que vuelven con cada producto archivado al restaurarlo.
  const [conteoVariantes, setConteoVariantes] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [productos, vars] = await Promise.all([
        fetchArchivedProducts(tenantId),
        fetchArchivedVariants(tenantId),
      ]);
      setArchivados(productos);
      setVariantes(vars);
      setConteoVariantes(await contarVariantes(tenantId, productos));
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;
    void Promise.all([fetchArchivedProducts(tenantId), fetchArchivedVariants(tenantId)])
      .then(async ([productos, vars]) => {
        if (cancelado) return;
        setArchivados(productos);
        setVariantes(vars);
        const conteo = await contarVariantes(tenantId, productos);
        if (!cancelado) setConteoVariantes(conteo);
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

  const variantesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return variantes;
    return variantes.filter(
      (v) =>
        nombreVariante(v).toLowerCase().includes(q) ||
        v.codigo_barras?.toLowerCase().includes(q) ||
        v.sku?.toLowerCase().includes(q)
    );
  }, [variantes, busqueda]);

  const restaurarVariante = async (variante: VarianteArchivada) => {
    setRestaurando(variante.id);
    try {
      await restoreVariant(variante.id);
      await logActivity({
        action: "UPDATE",
        entity: "producto",
        entityId: variante.id,
        entityName: nombreVariante(variante),
        details: { restaurado: true },
      });
      toast.success(
        variante.productos?.archivado_en
          ? `«${nombreVariante(variante)}» se restauró`
          : `«${nombreVariante(variante)}» vuelve al catálogo y al punto de venta`,
        variante.productos?.archivado_en
          ? { description: "Se verá cuando restaures su producto." }
          : undefined
      );
      await cargar();
      onRestaurado();
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setRestaurando(null);
    }
  };

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
      const n = conteoVariantes[producto.id] ?? 0;
      toast.success(
        n > 0
          ? `«${producto.nombre}» y ${n === 1 ? "su variante vuelven" : `sus ${n} variantes vuelven`} al catálogo y al punto de venta`
          : `«${producto.nombre}» vuelve al catálogo y al punto de venta`
      );
      await cargar();
      onRestaurado();
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setRestaurando(null);
    }
  };

  const botonRestaurar = (p: { id: string }, alRestaurar: () => Promise<void>) => (
    <Button
      variant="outline"
      size="sm"
      className="h-8 shrink-0 gap-1.5 text-xs"
      disabled={restaurando === p.id}
      onClick={() => void alRestaurar()}
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
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{p.nombre}</span>
                        <EtiquetaVariantes n={conteoVariantes[p.id] ?? 0} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.codigo_barras, `Archivado el ${fecha(p.archivado_en)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {botonRestaurar(p, () => restaurar(p))}
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
                            <EtiquetaVariantes n={conteoVariantes[p.id] ?? 0} />
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
                        <TableCell className="text-right">{botonRestaurar(p, () => restaurar(p))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {variantes.length > 0 && (
        <Card className="animate-fade-in-up">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">Variantes archivadas</CardTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {variantes.length} {variantes.length === 1 ? "variante" : "variantes"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {variantesFiltradas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No se encontraron variantes archivadas
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {variantesFiltradas.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2.5">
                    <Miniatura
                      producto={{ nombre: v.productos?.nombre ?? "", imagen_url: v.imagen_url }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nombreVariante(v)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.productos?.archivado_en
                          ? "Su producto también está archivado"
                          : [
                              v.sku || v.codigo_barras,
                              `$${v.precio_venta.toFixed(2)}`,
                              `Archivada el ${fecha(v.archivado_en ?? null)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    </div>
                    {botonRestaurar(v, () => restaurarVariante(v))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** "Coca Cola · 2.5 L": la variante sola no dice de que producto es. */
function nombreVariante(v: VarianteArchivada): string {
  const atributos = etiquetaAtributos(v);
  const producto = v.productos?.nombre ?? "Producto";
  return atributos ? `${producto} · ${atributos}` : producto;
}

/** Si falla el conteo, la lista sale igual (sin etiquetas). */
async function contarVariantes(tenantId: string, productos: Producto[]) {
  try {
    return await contarVariantesDeArchivados(
      tenantId,
      productos.map((p) => p.id)
    );
  } catch {
    return {};
  }
}

/** Mismo estilo que en el catalogo: vuelven con el producto al restaurarlo. */
function EtiquetaVariantes({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1e3a8a]/10 px-1.5 py-px text-[10px] font-semibold text-[#1e3a8a] dark:bg-blue-500/15 dark:text-blue-300"
      title="Vuelven con el producto al restaurarlo"
    >
      <Layers className="h-3 w-3" aria-hidden="true" />
      {n === 1 ? "1 variante" : `${n} variantes`}
    </span>
  );
}
