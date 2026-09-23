"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useSucursal } from "@/contexts/sucursal-context";
import { mensajeDeError } from "@/features/inventory/error-message";
import { conStockDeSucursal } from "@/features/sucursales/stock";
import {
  establecerStockSucursal,
  fetchStockSucursal,
} from "@/features/sucursales/services/stock-sucursal-service";

interface ProductoLocal {
  id: string;
  nombre: string;
  sku: string | null;
  es_servicio: boolean | null;
  stock_actual: number;
  se_vende: boolean;
}

/**
 * Lo que hay en UN local, producto por producto, y si ese local lo vende.
 *
 * La cantidad se edita como valor FINAL ("aqui hay 12"): es lo que el
 * encargado cuenta en el anaquel. El servidor calcula la diferencia. Para mover
 * mercancia ENTRE locales esta la pestaña de traspasos, que no deja unidades
 * creadas ni perdidas; editar aqui es para corregir un conteo.
 *
 * Los servicios salen con "—": no tienen existencias, pero si tienen "se vende
 * aqui" (un local puede no ofrecer envios a domicilio, por ejemplo).
 */
export function ExistenciasSucursal({ tenantId }: { tenantId: string }) {
  const { seleccionada, sucursales } = useSucursal();
  const { can } = usePermissions();
  const puedeEditar = can("inventory.manage");
  const [productos, setProductos] = useState<ProductoLocal[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  const nombre = sucursales.find((s) => s.id === seleccionada)?.nombre;

  const cargar = useCallback(async () => {
    if (!seleccionada) return;
    setCargando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const [{ data, error }, filas] = await Promise.all([
        supabase
          .from("productos")
          .select("id, nombre, sku, es_servicio, stock_actual")
          .eq("tenant_id", tenantId)
          .order("nombre"),
        fetchStockSucursal(seleccionada),
      ]);
      if (error) throw error;
      setProductos(conStockDeSucursal((data ?? []) as ProductoLocal[], filas));
      setBorradores({});
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setCargando(false);
    }
  }, [tenantId, seleccionada]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(t0);
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
  }, [productos, busqueda]);

  async function guardarCantidad(p: ProductoLocal) {
    if (!seleccionada) return;
    const texto = borradores[p.id];
    if (texto === undefined) return;
    const cantidad = Number(texto);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      toast.error("Escribe una cantidad válida (0 o más)");
      return;
    }
    if (cantidad === p.stock_actual) {
      setBorradores((b) => {
        const { [p.id]: _fuera, ...resto } = b;
        void _fuera;
        return resto;
      });
      return;
    }
    try {
      await establecerStockSucursal({
        sucursalId: seleccionada,
        productoId: p.id,
        cantidad,
      });
      toast.success(`${p.nombre}: ${cantidad} en ${nombre ?? "la sucursal"}`);
      await cargar();
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function alternarSeVende(p: ProductoLocal, valor: boolean) {
    if (!seleccionada) return;
    // Optimista: es un interruptor, esperar a la red lo haria "tardar".
    setProductos((prev) => prev.map((x) => (x.id === p.id ? { ...x, se_vende: valor } : x)));
    try {
      await establecerStockSucursal({ sucursalId: seleccionada, productoId: p.id, seVende: valor });
    } catch (error) {
      setProductos((prev) => prev.map((x) => (x.id === p.id ? { ...x, se_vende: !valor } : x)));
      toast.error(mensajeDeError(error));
    }
  }

  if (!seleccionada) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Elige una sucursal en el selector de arriba para ver y ajustar sus existencias.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Warehouse className="h-4 w-4" aria-hidden="true" />
          Existencias en {nombre}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Corrige aquí un conteo. Para mover mercancía entre locales usa{" "}
          <span className="font-medium">Traspasos</span>: así no se crean ni se pierden unidades.
          Apagar «Se vende aquí» oculta el producto en el punto de venta de este local.
        </p>
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto o SKU"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-[140px] text-right">Existencias</TableHead>
              <TableHead className="w-[130px] text-center">Se vende aquí</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">
                  <span className="font-medium">{p.nombre}</span>
                  {p.sku && <span className="ml-2 font-mono text-muted-foreground">{p.sku}</span>}
                </TableCell>
                <TableCell className="text-right">
                  {p.es_servicio ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : puedeEditar ? (
                    <Input
                      type="number"
                      min="0"
                      aria-label={`Existencias de ${p.nombre}`}
                      value={borradores[p.id] ?? String(p.stock_actual)}
                      onChange={(e) =>
                        setBorradores((b) => ({ ...b, [p.id]: e.target.value }))
                      }
                      onBlur={() => void guardarCantidad(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="ml-auto h-7 w-24 text-right font-mono text-xs"
                    />
                  ) : (
                    <span className="font-mono text-xs tabular-nums">{p.stock_actual}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={p.se_vende}
                    disabled={!puedeEditar}
                    onCheckedChange={(v) => void alternarSeVende(p, v)}
                    aria-label={`Se vende ${p.nombre} en ${nombre}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {cargando && (
          <p className="pt-3 text-center text-xs text-muted-foreground">Cargando…</p>
        )}
        {!cargando && visibles.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Sin productos.</p>
        )}
      </CardContent>
    </Card>
  );
}
