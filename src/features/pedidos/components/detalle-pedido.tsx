"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle, Minus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { useMoneda } from "@/hooks/use-moneda";
import { localeIntl } from "@/lib/idioma";
import { formatearCantidad } from "@/lib/unidades";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlCatalogo } from "@/features/catalogo/slug";
import { costoEnvioDeBase } from "@/features/catalogo/envio";
import {
  aceptarPedido,
  cancelarPedido,
  editarPedido,
  guardarMensajePedido,
  moverPedidoEstado,
  registrarPagoPedido,
  type LineaEdicion,
} from "../pedidos-service";
import { enlaceWhatsAppCliente, mensajeAlCliente } from "../mensaje-estado";
import {
  codigoDeErrorPedido,
  diferenciaDePrecio,
  estadosDisponibles,
  puedeAceptar,
  puedeCambiarEstado,
  puedeCancelar,
  puedeEditar,
  puedePagar,
} from "../transiciones";
import type { EstadoPropio, Pedido } from "../types";
import { AdministrarEstados } from "./administrar-estados";

type Metodo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
type Vista = "detalle" | "pago" | "editar" | "cancelar" | "admin";

interface ProductoBuscado {
  id: string;
  nombre: string;
  precio_venta: number;
}

/**
 * Detalle de un pedido del catálogo (migración 146). Cada acción va por su función de la base: aceptar (valida
 * existencias), cambiar estado propio, marcar pagado (aquí se registra la venta), editar productos, mensajes y cancelar.
 * Permiso `orders.manage`; cobrar exige también `sales.create`.
 */
export function DetallePedido({
  pedido,
  slug,
  negocio,
  tenantId,
  estados,
  onCerrar,
  onCambio,
  onEstados,
}: {
  pedido: Pedido;
  slug: string | null;
  negocio: string;
  tenantId: string;
  estados: EstadoPropio[];
  onCerrar: () => void;
  onCambio: () => Promise<void> | void;
  onEstados: () => Promise<void> | void;
}) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { can } = usePermissions();
  const { formatear } = useMoneda();
  const [vista, setVista] = useState<Vista>("detalle");
  // Tras cambiar el estado: el enlace de WhatsApp ya escrito para ese estado (null = no hay nada que avisar).
  const [avisoEstado, setAvisoEstado] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  const [diferencia, setDiferencia] = useState<{ pedido: number; venta: number } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [mensajeCliente, setMensajeCliente] = useState(pedido.mensaje_cliente ?? "");
  const [notaInterna, setNotaInterna] = useState(pedido.nota_interna ?? "");
  const [lineas, setLineas] = useState<LineaEdicion[]>([]);
  const [nombresLineas, setNombresLineas] = useState<Record<string, string>>({});
  const [preciosLineas, setPreciosLineas] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const [resultadosBuscados, setResultados] = useState<ProductoBuscado[]>([]);
  const resultados = busqueda.trim().length >= 2 ? resultadosBuscados : [];

  const puedeVender = can("sales.create");
  const disponibles = useMemo(() => estadosDisponibles(pedido, estados), [pedido, estados]);
  const urlSeguimiento = slug && pedido.codigo_seguimiento
    ? `${urlCatalogo(slug, locale)}/pedido/${pedido.codigo_seguimiento}`
    : null;
  const envio = pedido.entrega === "domicilio" ? costoEnvioDeBase(pedido.costo_envio) : null;
  const nombreEstado = pedido.estado_nombre ?? t(`status.${pedido.estado}`);
  const enlaceAviso = pedido.cliente_telefono
    ? enlaceWhatsAppCliente(
        pedido.cliente_telefono,
        mensajeAlCliente(pedido.estado, {
          negocio,
          folio: pedido.folio,
          nombre: pedido.cliente_nombre,
          entrega: pedido.entrega,
          estadoNombre: nombreEstado,
          urlSeguimiento,
          envio: envio !== null ? formatear(envio) : null,
          mensajeCliente: pedido.mensaje_cliente,
        })
      )
    : null;

  // Al abrir la edición: los renglones actuales (se llama al cambiar a la vista de edición, no en un efecto).
  const abrirEditar = () => {
    setLineas(
      pedido.pedido_items
        .filter((i) => i.producto_id)
        .map((i) => ({ producto_id: i.producto_id as string, variante_id: i.variante_id, cantidad: i.cantidad }))
    );
    setNombresLineas(Object.fromEntries(pedido.pedido_items.map((i) => [i.producto_id ?? i.id, i.nombre])));
    setPreciosLineas(Object.fromEntries(pedido.pedido_items.filter((i) => i.producto_id).map((i) => [i.producto_id as string, i.precio_unitario])));
    setVista("editar");
  };

  // Buscador de productos para agregar a la edición (solo productos sin variantes en esta versión).
  // Con menos de 2 letras no hay resultados: se calculan al mostrar, sin un efecto que los vacíe.
  useEffect(() => {
    if (vista !== "editar" || busqueda.trim().length < 2) return;
    let vigente = true;
    const timer = window.setTimeout(async () => {
      const { data } = await createSupabaseBrowserClient()
        .from("productos")
        .select("id, nombre, precio_venta")
        .eq("tenant_id", tenantId)
        .is("archivado_en", null)
        .eq("permite_variantes", false)
        .ilike("nombre", `%${busqueda.trim()}%`)
        .limit(12);
      if (vigente) {
        setResultados(
          (data ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre as string, precio_venta: Number(p.precio_venta) }))
        );
      }
    }, 250);
    return () => {
      vigente = false;
      window.clearTimeout(timer);
    };
  }, [busqueda, vista, tenantId]);

  const avisoError = (error: unknown) => {
    const texto = (error as { message?: string } | null)?.message ?? String(error ?? "");
    toast.error(t(`errors.${codigoDeErrorPedido(texto)}`));
  };

  const ejecutar = async (accion: () => Promise<unknown>, exito: string) => {
    setTrabajando(true);
    try {
      await accion();
      toast.success(exito);
      await onCambio();
      return true;
    } catch (error) {
      avisoError(error);
      return false;
    } finally {
      setTrabajando(false);
    }
  };

  const pagar = async (aceptaDiferencia: boolean) => {
    setTrabajando(true);
    try {
      await registrarPagoPedido(pedido.id, metodo, aceptaDiferencia);
      toast.success(t("v2.toast.paid"));
      setDiferencia(null);
      setVista("detalle");
      await onCambio();
    } catch (error) {
      const dif = diferenciaDePrecio((error as { message?: string } | null)?.message);
      if (dif) setDiferencia(dif);
      else avisoError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const guardarEdicion = async () => {
    if (lineas.length === 0) {
      toast.error(t("v2.editEmpty"));
      return;
    }
    const ok = await ejecutar(() => editarPedido(pedido.id, lineas), t("v2.toast.edited"));
    if (ok) setVista("detalle");
  };

  const guardarNotas = async () => {
    await ejecutar(() => guardarMensajePedido(pedido.id, mensajeCliente.trim(), notaInterna.trim()), t("v2.toast.notes"));
  };

  const fecha = new Date(pedido.creado_en).toLocaleString(localeIntl(locale), { dateStyle: "medium", timeStyle: "short" });
  const colorEstado = pedido.estado_color ?? "#64748B";
  const totalEditado = lineas.reduce((s, l) => s + (preciosLineas[l.producto_id] ?? 0) * l.cantidad, 0);

  return (
    <>
      <Dialog open onOpenChange={(abierto) => !abierto && !trabajando && onCerrar()}>
        <DialogContent className="max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("detail.title", { folio: pedido.folio })}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: colorEstado }}>
                {nombreEstado}
              </span>
              <span className="text-xs">{fecha}</span>
              <span className="text-xs">· {pedido.pagado ? t("v2.paid") : t("v2.unpaid")}</span>
            </DialogDescription>
          </DialogHeader>

          {vista === "detalle" && (
            <div className="space-y-4 text-sm">
              <section className="space-y-1">
                <p className="font-medium">{pedido.cliente_nombre}</p>
                {pedido.cliente_telefono && <p className="text-muted-foreground">{pedido.cliente_telefono}</p>}
                <p className="text-muted-foreground">
                  {t(`delivery.${pedido.entrega}`)}
                  {pedido.entrega === "domicilio" && pedido.direccion ? `: ${pedido.direccion}` : ""}
                </p>
                {pedido.nota && <p className="rounded-md bg-muted px-2.5 py-1.5">{pedido.nota}</p>}
                {pedido.origen === "pos" && <p className="text-xs text-muted-foreground">{t("v2.fromPos")}</p>}
              </section>

              <section>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {pedido.pedido_items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 px-3 py-2">
                      <span>
                        {formatearCantidad(i.cantidad, i.unidad ?? "PIEZA")} {i.nombre}
                        {i.variante ? ` (${i.variante})` : ""}
                      </span>
                      <span className="shrink-0">{formatear(i.precio_unitario * i.cantidad)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between text-base font-semibold">
                  <span>{t("detail.total")}</span>
                  <span>{formatear(pedido.total)}</span>
                </p>
                {envio !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {envio === 0 ? t("detail.shippingFree") : t("detail.shipping", { monto: formatear(envio) })}
                  </p>
                )}
                {pedido.venta_id && <p className="mt-1 text-xs text-muted-foreground">{t("detail.hasSale")}</p>}
              </section>

              {puedeCambiarEstado(pedido) && (
                <section className="space-y-2">
                  <p className="text-xs font-medium">{t("v2.stateTitle")}</p>
                  {disponibles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("v2.noStates")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {disponibles.map((e) => {
                        const actual = e.id === pedido.estado_id;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            disabled={trabajando || actual}
                            onClick={async () => {
                              const ok = await ejecutar(() => moverPedidoEstado(pedido.id, e.id), t("v2.toast.state"));
                              if (ok) {
                                setAvisoEstado(
                                  pedido.cliente_telefono
                                    ? enlaceWhatsAppCliente(
                                        pedido.cliente_telefono,
                                        mensajeAlCliente(e.base, {
                                          negocio,
                                          folio: pedido.folio,
                                          nombre: pedido.cliente_nombre,
                                          entrega: pedido.entrega,
                                          estadoNombre: e.nombre,
                                          urlSeguimiento,
                                          envio: envio !== null ? formatear(envio) : null,
                                          mensajeCliente: pedido.mensaje_cliente,
                                        })
                                      )
                                    : null
                                );
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-100 ${actual ? "border-transparent text-white" : "border-border hover:bg-muted"}`}
                            style={actual ? { backgroundColor: e.color } : undefined}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} aria-hidden="true" />
                            {e.nombre}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Button variant="link" className="h-auto px-0 text-xs" onClick={() => setVista("admin")}>
                    {t("v2.manageStates")}
                  </Button>
                  {avisoEstado && (
                    <div className="space-y-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs" role="status">
                      <p className="font-medium">{t("v2.notifyAsk")}</p>
                      <div className="flex gap-2">
                        <a
                          href={avisoEstado}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setAvisoEstado(null)}
                          className={buttonVariants({ size: "sm", className: "gap-1.5" })}
                        >
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("v2.notifySend")}
                        </a>
                        <Button size="sm" variant="outline" onClick={() => setAvisoEstado(null)}>
                          {t("v2.notifySkip")}
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="space-y-2 rounded-md border border-border p-3">
                <label className="block text-xs font-medium">
                  {t("v2.customerMessage")}
                  <Textarea value={mensajeCliente} maxLength={300} rows={2} onChange={(e) => setMensajeCliente(e.target.value)} className="mt-1" />
                </label>
                <label className="block text-xs font-medium">
                  {t("v2.internalNote")}
                  <Textarea value={notaInterna} maxLength={300} rows={2} onChange={(e) => setNotaInterna(e.target.value)} className="mt-1" />
                </label>
                <Button variant="outline" size="sm" disabled={trabajando} onClick={() => void guardarNotas()}>
                  {t("v2.saveNotes")}
                </Button>
              </section>
            </div>
          )}

          {vista === "pago" && (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-medium">{t("confirm.method")}</legend>
              {(["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const).map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="metodo" checked={metodo === m} onChange={() => setMetodo(m)} />
                  {t(`confirm.methods.${m}`)}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">{t("confirm.cashNote")}</p>
              {pedido.entrega === "domicilio" && <p className="text-xs text-muted-foreground">{t("confirm.deliveryNote")}</p>}
              {diferencia && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
                  <p className="font-medium">{t("confirm.diffTitle")}</p>
                  <p className="mt-1">{t("confirm.diffBody", { pedido: formatear(diferencia.pedido), venta: formatear(diferencia.venta) })}</p>
                </div>
              )}
            </fieldset>
          )}

          {vista === "editar" && (
            <div className="w-full min-w-0 space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">{t("v2.editHint")}</p>
              {pedido.pedido_items.some((i) => i.variante_id) && (
                <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs">{t("v2.editVariants")}</p>
              )}
              <ul className="divide-y divide-border rounded-md border border-border">
                {lineas.map((l) => (
                  <li key={l.producto_id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate">{nombresLineas[l.producto_id] ?? l.producto_id}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineas((prev) => prev.map((x) => x.producto_id === l.producto_id ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x))} aria-label={t("v2.less")}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{l.cantidad}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setLineas((prev) => prev.map((x) => x.producto_id === l.producto_id ? { ...x, cantidad: x.cantidad + 1 } : x))} aria-label={t("v2.more")}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLineas((prev) => prev.filter((x) => x.producto_id !== l.producto_id))} aria-label={t("v2.remove")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </li>
                ))}
                {lineas.length === 0 && <li className="px-3 py-2 text-muted-foreground">{t("v2.editEmpty")}</li>}
              </ul>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={t("v2.searchProduct")} className="pl-8" />
              </div>
              {resultados.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {resultados.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          setNombresLineas((prev) => ({ ...prev, [p.id]: p.nombre }));
                          setPreciosLineas((prev) => ({ ...prev, [p.id]: p.precio_venta }));
                          setLineas((prev) => {
                            const existe = prev.find((x) => x.producto_id === p.id);
                            return existe
                              ? prev.map((x) => (x.producto_id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x))
                              : [...prev, { producto_id: p.id, variante_id: null, cantidad: 1 }];
                          });
                          setBusqueda("");
                        }}
                      >
                        <span className="truncate">{p.nombre}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatear(p.precio_venta)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex justify-between font-medium">
                <span>{t("detail.total")}</span>
                <span>{formatear(totalEditado)}</span>
              </p>
            </div>
          )}

          {vista === "cancelar" && (
            <div className="space-y-3">
              <DialogDescription>{pedido.venta_id ? t("cancel.withSale") : t("cancel.noSale")}</DialogDescription>
              <Textarea value={motivo} maxLength={300} rows={3} onChange={(e) => setMotivo(e.target.value)} placeholder={t("cancel.reason")} aria-label={t("cancel.reason")} />
            </div>
          )}

          {vista === "admin" && (
            <AdministrarEstados
              tenantId={tenantId}
              estados={estados}
              onCambio={onEstados}
              onVolver={() => setVista("detalle")}
            />
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            {vista === "detalle" && (
              <>
                {enlaceAviso && (
                  <a href={enlaceAviso} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", className: "gap-2" })}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {t("actions.notify")}
                  </a>
                )}
                {urlSeguimiento && (
                  <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(urlSeguimiento).then(() => toast.success(t("v2.toast.copied")))}>
                    {t("v2.copyLink")}
                  </Button>
                )}
                {puedeAceptar(pedido) && (
                  <Button disabled={trabajando || !can("orders.manage")} onClick={() => void ejecutar(() => aceptarPedido(pedido.id), t("v2.toast.accepted"))}>
                    {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t("v2.accept")}
                  </Button>
                )}
                {puedePagar(pedido) && (
                  <Button disabled={trabajando || !puedeVender} onClick={() => { setDiferencia(null); setVista("pago"); }}>
                    {t("v2.markPaid")}
                  </Button>
                )}
                {puedeEditar(pedido) && (
                  <Button variant="outline" disabled={trabajando} onClick={abrirEditar}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("v2.edit")}
                  </Button>
                )}
                {puedeCancelar(pedido) && (
                  <Button variant="outline" className="text-destructive" disabled={trabajando} onClick={() => setVista("cancelar")}>
                    {t("actions.cancel")}
                  </Button>
                )}
              </>
            )}

            {vista === "pago" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={trabajando} onClick={() => { setDiferencia(null); setVista("detalle"); }}>
                  {t("actions.back")}
                </Button>
                <Button className="flex-1" disabled={trabajando} onClick={() => void pagar(Boolean(diferencia))}>
                  {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {diferencia ? t("confirm.acceptDiff") : t("v2.markPaid")}
                </Button>
              </div>
            )}

            {vista === "editar" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={trabajando} onClick={() => setVista("detalle")}>
                  {t("actions.back")}
                </Button>
                <Button className="flex-1" disabled={trabajando} onClick={() => void guardarEdicion()}>
                  {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t("v2.saveEdit")}
                </Button>
              </div>
            )}

            {vista === "cancelar" && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={trabajando} onClick={() => setVista("detalle")}>
                  {t("actions.back")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={trabajando || !motivo.trim()}
                  onClick={async () => {
                    if (await ejecutar(() => cancelarPedido(pedido.id, motivo.trim()), t("toast.cancelled"))) {
                      setMotivo("");
                      setVista("detalle");
                    }
                  }}
                >
                  {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {t("actions.cancel")}
                </Button>
              </div>
            )}

            {vista === "admin" && (
              <Button variant="outline" disabled={trabajando} onClick={() => setVista("detalle")}>
                {t("actions.back")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
