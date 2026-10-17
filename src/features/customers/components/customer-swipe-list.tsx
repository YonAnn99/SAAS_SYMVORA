"use client";

/**
 * Los clientes en celular: una pastilla por cliente en lugar de la tabla
 * (ver `components/ui/fila-deslizable.tsx`).
 *
 *   a la mitad  -> Eliminar | Abonar
 *   completo    -> Eliminar (con confirmacion)
 *   a la derecha -> su tarjeta de lealtad (la crea si no tiene)
 *   tocar       -> Editar
 *
 * Con saldo pendiente no se elimina (igual que el boton deshabilitado de
 * escritorio): se avisa y la pastilla reaparece.
 */

import { CreditCard, HandCoins, Trash2 } from "lucide-react";
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
  onEliminar,
  onVerTarjeta,
}: CustomerSwipeListProps) {
  const { verPista, alAbrir } = usePistaDeslizar();
  const conTarjetas = metaSellos !== null;

  return (
    <div className="space-y-2">
      {verPista && (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">
          {conTarjetas
            ? "Desliza ← para eliminar o abonar, → para ver su tarjeta"
            : "Desliza a la izquierda para eliminar o abonar"}
        </p>
      )}

      {clientes.map((c) => {
        const debe = c.saldo_pendiente > 0;
        const sellos = sellosDe(c.id);

        const eliminar: AccionFila = {
          id: "eliminar",
          etiqueta: "Eliminar",
          color: COLOR_ELIMINAR,
          icono: <Trash2 size={18} strokeWidth={2} />,
          alElegir: () => {
            if (debe) {
              toast.error("Tiene saldo pendiente: registra su abono antes de eliminarlo");
              return Promise.resolve(false);
            }
            return onEliminar(c);
          },
          confirmar: debe
            ? undefined
            : {
                titulo: `¿Eliminar a ${c.nombre}?`,
                descripcion:
                  sellos !== null
                    ? "También se borra su tarjeta de lealtad. No se puede deshacer"
                    : "No se puede deshacer",
              },
        };
        const abonar: AccionFila = {
          id: "abonar",
          etiqueta: "Abonar",
          color: COLOR_ABONO,
          icono: <HandCoins size={18} strokeWidth={2} />,
          alElegir: () => {
            if (debe) onAbonar(c);
            else toast.info(`${c.nombre} no tiene saldo pendiente`);
          },
          // El cliente sigue ahi: la pastilla reaparece.
          permanece: true,
        };

        return (
          <FilaDeslizable
            key={c.id}
            label={c.nombre}
            acciones={puedeEditar ? [eliminar, abonar] : [abonar]}
            accionInicio={
              conTarjetas
                ? {
                    id: "tarjeta",
                    etiqueta: sellos !== null ? "Tarjeta" : "Crear tarjeta",
                    color: COLOR_TARJETA,
                    icono: <CreditCard size={18} strokeWidth={2} />,
                    alElegir: () => onVerTarjeta(c),
                  }
                : undefined
            }
            onTap={puedeEditar ? () => onEditar(c) : undefined}
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
                Límite <span className="font-mono">${c.limite_credito.toFixed(2)}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              {debe ? (
                <Badge variant="destructive" className="px-1.5 py-0 font-mono text-[11px]">
                  ${c.saldo_pendiente.toFixed(2)}
                </Badge>
              ) : (
                <span className="font-mono text-sm opacity-50">$0.00</span>
              )}
              <p className="text-[10px] opacity-50">Saldo</p>
            </div>
          </FilaDeslizable>
        );
      })}
    </div>
  );
}
