"use client";

import { useMoneda } from "@/hooks/use-moneda";

/**
 * Los clientes en celular: una pastilla por cliente en lugar de la tabla
 * (ver `components/ui/fila-deslizable.tsx`).
 *
 *   a la mitad  -> Eliminar | Cuenta | Abonar
 *   completo    -> Eliminar (con confirmacion)
 *   a la derecha -> su tarjeta de lealtad (la crea si no tiene)
 *   tocar       -> Editar (o el estado de cuenta, si no puede editar)
 *
 * Con saldo pendiente no se elimina (igual que el boton deshabilitado de
 * escritorio): se avisa y la pastilla reaparece.
 */

import { useTranslations } from "next-intl";
import { CreditCard, HandCoins, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  COLOR_ELIMINAR,
  FilaDeslizable,
  usePistaDeslizar,
  type AccionFila,
} from "@/components/ui/fila-deslizable";
import type { Cliente } from "@/lib/types/database";

const COLOR_ABONO = "#10B981";
const COLOR_TARJETA = "#8B5CF6";
const COLOR_CUENTA = "#2563EB";

interface CustomerSwipeListProps {
  clientes: Cliente[];
  /** `inventory.manage`: editar y eliminar (misma regla que la RLS de `clientes`). */
  puedeEditar: boolean;
  /** Sellos de su tarjeta, si tiene (para "3/10"). */
  sellosDe: (clienteId: string) => number | null;
  /** Meta del programa; sin programa activo no hay deslizar a la derecha. */
  metaSellos: number | null;
  onEditar: (cliente: Cliente) => void;
  onAbonar: (cliente: Cliente) => void;
  /** Estado de cuenta: ventas a credito y abonos (migracion 129). */
  onEstadoCuenta: (cliente: Cliente) => void;
  /** `false` si no se pudo: la pastilla reaparece. */
  onEliminar: (cliente: Cliente) => Promise<boolean>;
  onVerTarjeta: (cliente: Cliente) => void;
}

export function CustomerSwipeList({
  clientes,
  puedeEditar,
  sellosDe,
  metaSellos,
  onEditar,
  onAbonar,
  onEstadoCuenta,
  onEliminar,
  onVerTarjeta,
}: CustomerSwipeListProps) {
  const { formatear } = useMoneda();
  const { verPista, alAbrir } = usePistaDeslizar();
  const t = useTranslations("customers");
  const conTarjetas = metaSellos !== null;

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          {conTarjetas
            ? t("swipeHintCards")
            : t("swipeHint")}
        </p>
      )}

      {clientes.map((c) => {
        const debe = c.saldo_pendiente > 0;
        const sellos = sellosDe(c.id);

        const eliminar: AccionFila = {
          id: "eliminar",
          etiqueta: t("delete"),
          color: COLOR_ELIMINAR,
          icono: <Trash2 size={18} strokeWidth={2} />,
          alElegir: () => {
            if (debe) {
              toast.error(t("deleteHasBalance"));
              return Promise.resolve(false);
            }
            return onEliminar(c);
          },
          confirmar: debe
            ? undefined
            : {
                titulo: t("deleteTitle", { nombre: c.nombre }),
                descripcion:
                  sellos !== null
                    ? t("deleteWithCard")
                    : t("deleteNoUndo"),
              },
        };
        const abonar: AccionFila = {
          id: "abonar",
          etiqueta: t("pay"),
          color: COLOR_ABONO,
          icono: <HandCoins size={18} strokeWidth={2} />,
          alElegir: () => {
            if (debe) onAbonar(c);
            else toast.info(`${c.nombre} no tiene saldo pendiente`);
          },
          // El cliente sigue ahi: la pastilla reaparece.
          permanece: true,
        };

        const cuenta: AccionFila = {
          id: "cuenta",
          etiqueta: t("account"),
          color: COLOR_CUENTA,
          icono: <Receipt size={18} strokeWidth={2} />,
          alElegir: () => onEstadoCuenta(c),
          permanece: true,
        };

        return (
          <FilaDeslizable
            key={c.id}
            label={c.nombre}
            acciones={puedeEditar ? [eliminar, cuenta, abonar] : [cuenta, abonar]}
            accionInicio={
              conTarjetas
                ? {
                    id: "tarjeta",
                    etiqueta: sellos !== null ? t("card") : t("createCard"),
                    color: COLOR_TARJETA,
                    icono: <CreditCard size={18} strokeWidth={2} />,
                    alElegir: () => onVerTarjeta(c),
                  }
                : undefined
            }
            onTap={puedeEditar ? () => onEditar(c) : () => onEstadoCuenta(c)}
            onOpenChange={alAbrir}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {c.nombre}
                {sellos !== null && metaSellos !== null && (
                  <span className="ml-2 font-mono text-[11px] opacity-60">
                    {sellos}/{metaSellos}
                  </span>
                )}
              </p>
              <p className="truncate text-xs opacity-60">
                {t("limit")} <span className="font-mono">{formatear(c.limite_credito)}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              {debe ? (
                <Badge variant="destructive" className="px-1.5 py-0 font-mono text-[11px]">
                  {formatear(c.saldo_pendiente)}
                </Badge>
              ) : (
                <span className="font-mono text-sm opacity-50">{formatear(0)}</span>
              )}
              <p className="text-[10px] opacity-50">{t("balance")}</p>
            </div>
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
