"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { useMoneda } from "@/hooks/use-moneda";
import { localeIntl } from "@/lib/idioma";
import { formatearCantidad } from "@/lib/unidades";
import { urlCatalogo } from "@/features/catalogo/slug";
import { cambiarEstadoPedido, cancelarPedido, confirmarPedido } from "../pedidos-service";
import { enlaceWhatsAppCliente, mensajeAlCliente } from "../mensaje-estado";
import { accionesDe, codigoDeErrorPedido, diferenciaDePrecio, siguientePaso, type EstadoDeAvance } from "../transiciones";
import type { Pedido } from "../types";

type Metodo = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";

/**
 * Detalle de un pedido del catálogo y lo que se puede hacer con él (migración 141): confirmar (crea la venta y baja el
 * stock), avanzar de estado, avisar por WhatsApp y cancelar. Las reglas viven en `transiciones.ts` y en la base.
 */
export function DetallePedido({
  pedido,
  slug,
  negocio,
  onCerrar,
  onCambio,
}: {
  pedido: Pedido;
  slug: string | null;
  negocio: string;
  onCerrar: () => void;
  /** Tras cualquier cambio exitoso: la lista se vuelve a pedir. */
  onCambio: () => Promise<unknown> | void;
}) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { can } = usePermissions();
  const { formatear } = useMoneda();
  const [trabajando, setTrabajando] = useState(false);
  const [metodo, setMetodo] = useState<Metodo>("TRANSFERENCIA");
  const [confirmando, setConfirmando] = useState(false);
  const [diferencia, setDiferencia] = useState<{ pedido: number; venta: number } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const acciones = accionesDe(pedido.estado, pedido.entrega);
  const siguiente = siguientePaso(pedido.estado, pedido.entrega);
  const puedeVender = can("sales.create");
  const urlSeguimiento = slug ? `${urlCatalogo(slug, locale)}/pedido/${pedido.codigo_seguimiento}` : null;
  const enlaceAviso = enlaceWhatsAppCliente(
    pedido.cliente_telefono,
    mensajeAlCliente(pedido.estado, {
      negocio,
      folio: pedido.folio,
      nombre: pedido.cliente_nombre,
      entrega: pedido.entrega,
      urlSeguimiento,
      envio: pedido.entrega === "domicilio" && pedido.costo_envio ? formatear(pedido.costo_envio) : null,
    })
  );

  const avisoError = (error: unknown) => {
    const texto = (error as { message?: string } | null)?.message ?? String(error ?? "");
    toast.error(t(`errors.${codigoDeErrorPedido(texto)}`));
  };

  const ejecutar = async (accion: () => Promise<void>, exito: string) => {
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

  const confirmar = async (aceptaDiferencia: boolean) => {
    setTrabajando(true);
    try {
      await confirmarPedido(pedido.id, metodo, aceptaDiferencia);
      toast.success(t("toast.confirmed"));
      setConfirmando(false);
      setDiferencia(null);
      await onCambio();
    } catch (error) {
      const texto = (error as { message?: string } | null)?.message;
      const dif = diferenciaDePrecio(texto);
      if (dif) setDiferencia(dif);
      else avisoError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const fecha = new Date(pedido.creado_en).toLocaleString(localeIntl(locale), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("detail.title", { folio: pedido.folio })}</DialogTitle>
            <DialogDescription>
              {t(`status.${pedido.estado}`)} · {fecha}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <section className="space-y-1">
              <p className="font-medium">{pedido.cliente_nombre}</p>
              <p className="text-muted-foreground">{pedido.cliente_telefono}</p>
              <p className="text-muted-foreground">
                {t(`delivery.${pedido.entrega}`)}
                {pedido.entrega === "domicilio" && pedido.direccion ? `: ${pedido.direccion}` : ""}
              </p>
              {pedido.nota && <p className="rounded-md bg-muted px-2.5 py-1.5">{pedido.nota}</p>}
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
              {pedido.entrega === "domicilio" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {pedido.costo_envio === null
                    ? t("detail.shippingNone")
                    : pedido.costo_envio === 0
                      ? t("detail.shippingFree")
                      : t("detail.shipping", { monto: formatear(pedido.costo_envio) })}
                </p>
              )}
              {pedido.venta_id && <p className="mt-1 text-xs text-muted-foreground">{t("detail.hasSale")}</p>}
            </section>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
            {enlaceAviso && (
              <a
                href={enlaceAviso}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", className: "gap-2" })}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t("actions.notify")}
              </a>
            )}

            {acciones.includes("confirmar") && (
              <Button onClick={() => setConfirmando(true)} disabled={trabajando || !puedeVender}>
                {t("actions.confirm")}
              </Button>
            )}
            {acciones.includes("confirmar") && !puedeVender && (
              <p className="text-xs text-muted-foreground">{t("detail.needSalesPermission")}</p>
            )}

            {siguiente && (
              <Button
                disabled={trabajando}
                onClick={() => void ejecutar(() => cambiarEstadoPedido(pedido.id, siguiente), t("toast.updated"))}
              >
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t(`actions.advance.${siguiente}`)}
              </Button>
            )}
            {acciones
              .filter((a): a is EstadoDeAvance => a !== "confirmar" && a !== "cancelar" && a !== siguiente)
              .map((a) => (
                <Button
                  key={a}
                  variant="ghost"
                  size="sm"
                  disabled={trabajando}
                  onClick={() => void ejecutar(() => cambiarEstadoPedido(pedido.id, a), t("toast.updated"))}
                >
                  {t(`actions.advance.${a}`)}
                </Button>
              ))}

            {acciones.includes("cancelar") && (
              <Button variant="outline" className="text-destructive" disabled={trabajando} onClick={() => setCancelando(true)}>
                {t("actions.cancel")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmando} onOpenChange={(abierto) => !abierto && !trabajando && (setConfirmando(false), setDiferencia(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirm.title", { folio: pedido.folio })}</DialogTitle>
            <DialogDescription>{t("confirm.desc")}</DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">{t("confirm.method")}</legend>
            {(["TRANSFERENCIA", "TARJETA", "EFECTIVO"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="metodo" checked={metodo === m} onChange={() => setMetodo(m)} />
                {t(`confirm.methods.${m}`)}
              </label>
            ))}
            <p className="text-xs text-muted-foreground">{t("confirm.cashNote")}</p>
            {pedido.entrega === "domicilio" && (
              <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                {t("confirm.deliveryNote")}
                {pedido.costo_envio ? ` ${t("confirm.shippingNote", { monto: formatear(pedido.costo_envio) })}` : ""}
              </p>
            )}
          </fieldset>
          {diferencia && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="alert">
              <p className="font-medium">{t("confirm.diffTitle")}</p>
              <p className="mt-1">
                {t("confirm.diffBody", { pedido: formatear(diferencia.pedido), venta: formatear(diferencia.venta) })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={trabajando} onClick={() => (setConfirmando(false), setDiferencia(null))}>
              {t("actions.back")}
            </Button>
            <Button disabled={trabajando} onClick={() => void confirmar(Boolean(diferencia))}>
              {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {diferencia ? t("confirm.acceptDiff") : t("actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelando} onOpenChange={(abierto) => !abierto && !trabajando && setCancelando(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cancel.title", { folio: pedido.folio })}</DialogTitle>
            <DialogDescription>{pedido.venta_id ? t("cancel.withSale") : t("cancel.noSale")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            maxLength={300}
            rows={3}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("cancel.reason")}
            aria-label={t("cancel.reason")}
          />
          <DialogFooter>
            <Button variant="outline" disabled={trabajando} onClick={() => setCancelando(false)}>
              {t("actions.back")}
            </Button>
            <Button
              variant="destructive"
              disabled={trabajando || !motivo.trim()}
              onClick={async () => {
                if (await ejecutar(() => cancelarPedido(pedido.id, motivo.trim()), t("toast.cancelled"))) {
                  setCancelando(false);
                  setMotivo("");
                }
              }}
            >
              {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
