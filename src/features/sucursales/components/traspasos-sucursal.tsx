"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpecularActionButton } from "@/components/ui/specular-action-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/supabase/activity-logger";
import { usePermissions } from "@/hooks/use-permissions";
import { useSucursal } from "@/contexts/sucursal-context";
import { mensajeDeError } from "@/features/inventory/error-message";
import {
  fetchStockSucursal,
  fetchTraspasos,
  registrarTraspaso,
  type TraspasoHistorial,
} from "@/features/sucursales/services/stock-sucursal-service";
import { opcionesDeTraspaso, type OpcionTraspaso } from "@/features/sucursales/traspaso";

interface Linea {
  valor: string;
  cantidad: string;
}

const LINEA_VACIA: Linea = { valor: "", cantidad: "" };

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Mover mercancia entre locales, y el historial de lo movido.
 *
 * Solo se ofrecen los productos que HAY en el origen, con cuanto hay al lado:
 * elegir algo que no existe ahi solo serviria para que el servidor lo rechace.
 * El servidor vuelve a validarlo todo igualmente (y bloquea la fila, por si
 * entre tanto se vendio): lo de aqui es para decirlo antes y sin viaje.
 */
export function TraspasosSucursal({ tenantId }: { tenantId: string }) {
  const { todasActivas, sucursales, seleccionada, permitidas } = useSucursal();
  const { can } = usePermissions();
  const puedeTraspasar = can("inventory.manage");

  const [origen, setOrigen] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [lineas, setLineas] = useState<Linea[]>([LINEA_VACIA]);
  const [notas, setNotas] = useState("");
  const [opciones, setOpciones] = useState<OpcionTraspaso[]>([]);
  const [historial, setHistorial] = useState<TraspasoHistorial[]>([]);
  const [enviando, setEnviando] = useState(false);

  // El origen arranca en la sucursal que se esta mirando: es el caso tipico
  // ("en Centro sobra, lo mando a Norte").
  useEffect(() => {
    const t0 = window.setTimeout(() => {
      setOrigen((o) => o || seleccionada || "");
    }, 0);
    return () => window.clearTimeout(t0);
  }, [seleccionada]);

  const cargarOpciones = useCallback(async () => {
    if (!origen) {
      setOpciones([]);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const [prods, vars, filas] = await Promise.all([
        supabase.from("productos").select("id, nombre, es_servicio").eq("tenant_id", tenantId),
        supabase.from("variantes_producto").select("id, producto_id, talla, color").eq("tenant_id", tenantId),
        fetchStockSucursal(origen),
      ]);
      if (prods.error) throw prods.error;
      if (vars.error) throw vars.error;
      setOpciones(opcionesDeTraspaso(prods.data ?? [], vars.data ?? [], filas));
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }, [tenantId, origen]);

  const cargarHistorial = useCallback(async () => {
    try {
      setHistorial(await fetchTraspasos(tenantId));
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }, [tenantId]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void cargarOpciones(), 0);
    return () => window.clearTimeout(t0);
  }, [cargarOpciones]);

  useEffect(() => {
    const t0 = window.setTimeout(() => void cargarHistorial(), 0);
    return () => window.clearTimeout(t0);
  }, [cargarHistorial]);

  const porValor = useMemo(() => new Map(opciones.map((o) => [o.valor, o])), [opciones]);

  // ORIGEN: solo los locales del usuario (la base lo exige, migracion 085), y
  // puede estar CERRADO: vaciarlo es justo para lo que sirve un traspaso.
  // DESTINO: cualquier local abierto del negocio; mandar mercancia a otra
  // tienda es normal aunque no la lleves.
  const origenes = sucursales.filter((s) => permitidas.includes(s.id));
  const destinos = todasActivas.filter((s) => s.id !== origen);

  function cambiarOrigen(id: string) {
    setOrigen(id);
    // Las lineas elegidas eran del origen anterior: con otro origen, las
    // cantidades disponibles ya no son esas.
    setLineas([LINEA_VACIA]);
    if (id === destino) setDestino("");
  }

  function actualizar(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  async function enviar() {
    if (!origen || !destino) {
      toast.error("Elige la sucursal de origen y la de destino");
      return;
    }
    const validas = lineas.filter((l) => l.valor);
    if (validas.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    for (const l of validas) {
      const op = porValor.get(l.valor);
      const cant = Number(l.cantidad);
      if (!op) continue;
      if (!Number.isFinite(cant) || cant <= 0) {
        toast.error(`Escribe una cantidad para «${op.etiqueta}»`);
        return;
      }
      if (cant > op.disponible) {
        toast.error(`Solo hay ${op.disponible} de «${op.etiqueta}» en el origen`);
        return;
      }
    }

    setEnviando(true);
    try {
      const res = await registrarTraspaso({
        origenId: origen,
        destinoId: destino,
        notas: notas.trim() || null,
        lineas: validas.map((l) => {
          const op = porValor.get(l.valor)!;
          return { productoId: op.productoId, varianteId: op.varianteId, cantidad: Number(l.cantidad) };
        }),
      });
      const nombreDe = (id: string) => sucursales.find((s) => s.id === id)?.nombre ?? "";
      await logActivity({
        action: "CREATE",
        entity: "traspaso",
        entityId: res.traspaso_id,
        entityName: `${nombreDe(origen)} → ${nombreDe(destino)}`,
        details: { lineas: res.lineas },
      });
      toast.success(`Traspaso registrado: ${res.lineas} producto(s) a ${nombreDe(destino)}`);
      setLineas([LINEA_VACIA]);
      setNotas("");
      await Promise.all([cargarOpciones(), cargarHistorial()]);
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {puedeTraspasar && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              Nuevo traspaso
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Se descuenta del origen y se suma al destino en una sola operación: o pasan
              todos los productos, o ninguno.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="traspaso-origen">Desde</Label>
                <select
                  id="traspaso-origen"
                  value={origen}
                  onChange={(e) => cambiarOrigen(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Sucursal de origen…</option>
                  {origenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {!s.activa ? " (cerrada)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground sm:block sm:mb-2.5" aria-hidden="true" />
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="traspaso-destino">Hacia</Label>
                <select
                  id="traspaso-destino"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Sucursal de destino…</option>
                  {destinos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {origen && (
              <div className="space-y-2">
                <Label className="text-xs">Productos</Label>
                {opciones.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay existencias en esta sucursal para traspasar.
                  </p>
                )}
                {lineas.map((l, i) => {
                  const op = porValor.get(l.valor);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        aria-label="Producto"
                        value={l.valor}
                        onChange={(e) => actualizar(i, "valor", e.target.value)}
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Producto…</option>
                        {opciones.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.etiqueta} ({o.disponible} disp.)
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="0"
                        aria-label="Cantidad"
                        placeholder={op ? `máx. ${op.disponible}` : "Cant."}
                        value={l.cantidad}
                        onChange={(e) => actualizar(i, "cantidad", e.target.value)}
                        className="h-9 w-28 text-sm font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        aria-label="Quitar producto"
                        onClick={() =>
                          setLineas((prev) => (prev.length === 1 ? [LINEA_VACIA] : prev.filter((_, j) => j !== i)))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setLineas((prev) => [...prev, LINEA_VACIA])}
                  disabled={opciones.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Otro producto
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="traspaso-notas">Notas (opcional)</Label>
              <Input
                id="traspaso-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. reposición de fin de semana"
                className="h-8 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <SpecularActionButton tone="add" className="h-9" disabled={enviando} onClick={() => void enviar()}>
                {enviando ? "Registrando…" : "Registrar traspaso"}
              </SpecularActionButton>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Últimos traspasos</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Todavía no hay traspasos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {historial.map((t) => (
                <li key={t.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{t.origen}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="font-medium">{t.destino}</span>
                    <span className="text-muted-foreground">· {fechaCorta(t.creado_en)}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {t.lineas.map((l) => `${l.cantidad} × ${l.producto}`).join(", ")}
                    {t.notas ? ` — ${t.notas}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
