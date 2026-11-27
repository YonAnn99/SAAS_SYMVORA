"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentTenant } from "@/hooks/use-current-tenant";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlan } from "@/hooks/use-plan";
import type { TicketConfig } from "@/lib/types/database";
import {
  LIMITES_TICKET,
  TICKET_CONFIG_DEFAULT,
  normalizarTicketConfig,
  puedeQuitarMarcaTicket,
  ticketConfigEfectiva,
} from "../ticket-config";
import type { SaleReceipt } from "../types/pos.types";
import { TicketCuerpo } from "./ticket-cuerpo";

/** Venta de muestra para la vista previa: nunca se guarda. */
const EJEMPLO: SaleReceipt = {
  items: [
    { productId: "ejemplo-1", varianteId: null, nombre: "Café americano", cantidad: 2, precioUnitario: 35, descuento: 0, unidad_medida: "PIEZA" },
    { productId: "ejemplo-2", varianteId: null, nombre: "Pan de chocolate", cantidad: 1, precioUnitario: 18.5, descuento: 0, unidad_medida: "PIEZA" },
  ],
  total: 88.5,
  paymentMethod: "EFECTIVO",
  customerName: "María López",
  montoRecibido: 100,
  cambio: 11.5,
  reference: "EJEMPLO",
  fecha: null,
  cajero: "Ana",
};

/**
 * Pestaña «Ticket» de Configuración: el formulario y, a la derecha, el ticket de muestra que cambia
 * mientras se escribe. Se monta al abrir la pestaña, así que parte de lo guardado.
 */
export function TicketConfigForm({
  valor,
  onGuardar,
}: {
  valor: TicketConfig;
  onGuardar: (cfg: TicketConfig) => Promise<void>;
}) {
  const t = useTranslations("settings.ticket");
  const { tenantName, tenantLogo, tenantAddress, moneda } = useCurrentTenant();
  const { can } = usePermissions();
  const { funciones, listo } = usePlan();
  const puedeEditar = can("org.manage_settings");
  const puedeQuitarMarca = listo && puedeQuitarMarcaTicket(funciones);

  const [borrador, setBorrador] = useState<TicketConfig>(valor);
  const [guardando, setGuardando] = useState(false);
  const [ancho, setAncho] = useState<58 | 80>(80);

  const cambiar = <K extends keyof TicketConfig>(clave: K, nuevo: TicketConfig[K]) =>
    setBorrador((b) => ({ ...b, [clave]: nuevo }));

  const limpio = normalizarTicketConfig(borrador);
  const sinCambios = JSON.stringify(limpio) === JSON.stringify(normalizarTicketConfig(valor));
  const vista = ticketConfigEfectiva(limpio, puedeQuitarMarca);

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(limpio);
      setBorrador(limpio);
    } finally {
      setGuardando(false);
    }
  };

  const fila = (titulo: string, control: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <Label className="text-xs">{titulo}</Label>
      {control}
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {!puedeEditar && (
          <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("header")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fila(
              t("showLogo"),
              <Switch
                checked={borrador.mostrarLogo}
                disabled={!puedeEditar}
                onCheckedChange={(v) => cambiar("mostrarLogo", v)}
              />
            )}
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ticket-telefono">{t("phone")}</Label>
              <Input
                id="ticket-telefono"
                value={borrador.telefono}
                maxLength={LIMITES_TICKET.telefono}
                disabled={!puedeEditar}
                onChange={(e) => cambiar("telefono", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ticket-linea">{t("extraLine")}</Label>
              <Input
                id="ticket-linea"
                value={borrador.lineaExtra}
                maxLength={LIMITES_TICKET.lineaExtra}
                placeholder={t("extraLineHint")}
                disabled={!puedeEditar}
                onChange={(e) => cambiar("lineaExtra", e.target.value)}
              />
            </div>
            {fila(
              t("showAddress"),
              <Switch
                checked={borrador.mostrarDireccion}
                disabled={!puedeEditar}
                onCheckedChange={(v) => cambiar("mostrarDireccion", v)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("footer")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ticket-gracias">{t("thankYou")}</Label>
              <Textarea
                id="ticket-gracias"
                rows={3}
                value={borrador.mensajePie}
                maxLength={LIMITES_TICKET.mensajePie}
                placeholder={t("thankYouHint")}
                disabled={!puedeEditar}
                onChange={(e) => cambiar("mensajePie", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ticket-redes">{t("socials")}</Label>
              <Input
                id="ticket-redes"
                value={borrador.redes}
                maxLength={LIMITES_TICKET.redes}
                disabled={!puedeEditar}
                onChange={(e) => cambiar("redes", e.target.value)}
              />
            </div>
            {fila(
              puedeQuitarMarca ? t("hideBrand") : `${t("hideBrand")} · ${t("hideBrandLocked")}`,
              <Switch
                checked={puedeQuitarMarca && borrador.ocultarMarca}
                disabled={!puedeEditar || !puedeQuitarMarca}
                onCheckedChange={(v) => cambiar("ocultarMarca", v)}
              />
            )}
            <p className="text-[11px] text-muted-foreground">{t("fixedNote")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("data")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {fila(t("showOperation"), <Switch checked={borrador.mostrarOperacion} disabled={!puedeEditar} onCheckedChange={(v) => cambiar("mostrarOperacion", v)} />)}
            {fila(t("showCashier"), <Switch checked={borrador.mostrarCajero} disabled={!puedeEditar} onCheckedChange={(v) => cambiar("mostrarCajero", v)} />)}
            {fila(t("showCustomer"), <Switch checked={borrador.mostrarCliente} disabled={!puedeEditar} onCheckedChange={(v) => cambiar("mostrarCliente", v)} />)}
            {fila(t("showItems"), <Switch checked={borrador.mostrarCantidadItems} disabled={!puedeEditar} onCheckedChange={(v) => cambiar("mostrarCantidadItems", v)} />)}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void guardar()}
            disabled={!puedeEditar || sinCambios || guardando}
          >
            {t("save")}
          </Button>
          <Button
            variant="outline"
            disabled={!puedeEditar || guardando}
            onClick={() => setBorrador(TICKET_CONFIG_DEFAULT)}
          >
            {t("reset")}
          </Button>
        </div>
      </div>

      <div className="space-y-2 md:sticky md:top-4 md:self-start">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t("preview")}</p>
          <div className="flex gap-1">
            {([58, 80] as const).map((mm) => (
              <Button
                key={mm}
                size="sm"
                variant={ancho === mm ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setAncho(mm)}
              >
                {mm === 58 ? t("width58") : t("width80")}
              </Button>
            ))}
          </div>
        </div>
        <div
          className="ticket-preview mx-auto max-w-full overflow-hidden rounded-lg bg-white p-3 text-black shadow-sm"
          style={{ width: ancho === 58 ? 240 : 320 }}
        >
          <TicketCuerpo
            receipt={EJEMPLO}
            negocio={{ nombre: tenantName ?? "", logo: tenantLogo, direccion: tenantAddress, moneda }}
            config={vista}
          />
        </div>
      </div>
    </div>
  );
}
