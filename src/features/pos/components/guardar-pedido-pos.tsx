"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlan } from "@/hooks/use-plan";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { codigoDeErrorPedido } from "@/features/pedidos/transiciones";
import type { CartItem } from "../types/pos.types";

/**
 * «Guardar pedido» desde el punto de venta (migración 146): el cliente pidió y paga después. El pedido queda confirmado,
 * sin tocar stock ni caja; se cobra desde Pedidos con «Marcar pagado». Pro y Premium con permiso de pedidos.
 * Los precios los recalcula la base con el catálogo, así que no se confía en el precio del carrito.
 */
export function GuardarPedidoPos({
  tenantId,
  items,
  cliente,
  onGuardado,
}: {
  tenantId: string;
  items: CartItem[];
  cliente: { nombre: string; telefono: string | null } | null;
  onGuardado: () => void;
}) {
  const t = useTranslations("pos.pedido");
  const { can } = usePermissions();
  const { permite } = usePlan();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [entrega, setEntrega] = useState<"recoger" | "domicilio">("recoger");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [mensajeCliente, setMensajeCliente] = useState("");
  const [notaInterna, setNotaInterna] = useState("");

  if (!permite("pedidos") || !can("orders.manage") || items.length === 0) return null;

  const abrir = () => {
    setNombre(cliente?.nombre ?? "");
    setTelefono(cliente?.telefono ?? "");
    setAbierto(true);
  };

  const guardar = async () => {
    if (nombre.trim().length < 1) {
      toast.error(t("needName"));
      return;
    }
    if (entrega === "domicilio" && direccion.trim().length < 5) {
      toast.error(t("needAddress"));
      return;
    }
    setGuardando(true);
    try {
      const { data, error } = await createSupabaseBrowserClient().rpc("crear_pedido_interno", {
        p_tenant: tenantId,
        p_cliente_nombre: nombre.trim(),
        p_telefono: telefono.trim() || null,
        p_entrega: entrega,
        p_direccion: entrega === "domicilio" ? direccion.trim() : null,
        p_mensaje_cliente: mensajeCliente.trim() || null,
        p_nota_interna: notaInterna.trim() || null,
        p_items: items.map((i) => ({ producto_id: i.productId, variante_id: i.varianteId, cantidad: i.cantidad })),
      });
      if (error) throw error;
      const folio = (data as { folio?: number } | null)?.folio;
      toast.success(t("saved", { folio: folio ?? "" }));
      setAbierto(false);
      setMensajeCliente("");
      setNotaInterna("");
      onGuardado();
    } catch (error) {
      const texto = (error as { message?: string } | null)?.message ?? "";
      toast.error(t(`errors.${codigoDeErrorPedido(texto)}`));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full" onClick={abrir} disabled={guardando}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {t("button")}
      </Button>

      <Dialog open={abierto} onOpenChange={(v) => !guardando && setAbierto(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {(["recoger", "domicilio"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEntrega(v)}
                  className={`h-9 rounded-md border text-sm font-medium ${entrega === v ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {t(`delivery.${v}`)}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium">
              {t("name")}
              <Input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium">
              {t("phone")}
              <Input value={telefono} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} className="mt-1" />
            </label>
            {entrega === "domicilio" && (
              <label className="block text-xs font-medium">
                {t("address")}
                <Textarea value={direccion} maxLength={200} rows={2} onChange={(e) => setDireccion(e.target.value)} className="mt-1" />
              </label>
            )}
            <label className="block text-xs font-medium">
              {t("customerMessage")}
              <Textarea value={mensajeCliente} maxLength={300} rows={2} onChange={(e) => setMensajeCliente(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium">
              {t("internalNote")}
              <Textarea value={notaInterna} maxLength={300} rows={2} onChange={(e) => setNotaInterna(e.target.value)} className="mt-1" />
            </label>
            <p className="text-xs text-muted-foreground">{t("note")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={guardando} onClick={() => setAbierto(false)}>
              {t("back")}
            </Button>
            <Button disabled={guardando} onClick={() => void guardar()}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
