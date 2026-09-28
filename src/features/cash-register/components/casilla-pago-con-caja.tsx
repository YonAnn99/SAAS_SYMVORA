"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMXN } from "@/lib/money";
import { cajaParaPago, type CajaAbierta } from "../conceptos";
import { fetchMisCajasAbiertas } from "../services/cash-register-service";

/**
 * La caja de donde saldría el efectivo para pagar una compra, o `null` si el
 * usuario no tiene ninguna abierta. Se consulta cada vez que se abre el
 * diálogo: la caja pudo abrirse o cerrarse mientras tanto.
 */
export function useCajaParaPago(
  tenantId: string | null,
  abierto: boolean,
  sucursalId: string | null
): { caja: CajaAbierta | null; cargando: boolean } {
  const [cajas, setCajas] = useState<CajaAbierta[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto || !tenantId) return;
    let vigente = true;
    // Diferido, convención del repo: setState síncrono en un efecto encadena
    // renders.
    const t0 = window.setTimeout(async () => {
      setCargando(true);
      const data = await fetchMisCajasAbiertas(tenantId);
      if (!vigente) return;
      setCajas(data);
      setCargando(false);
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(t0);
    };
  }, [tenantId, abierto]);

  return { caja: cajaParaPago(cajas, sucursalId), cargando };
}

/**
 * "Pagada con efectivo de la caja". Marcada, el servidor registra una SALIDA
 * en esa caja al guardar la compra (migración 093). Empieza desmarcada: muchas
 * compras se pagan por transferencia o quedan a crédito con el proveedor.
 */
export function CasillaPagoConCaja({
  caja,
  cargando,
  total,
  checked,
  onCheckedChange,
}: {
  caja: CajaAbierta | null;
  cargando: boolean;
  /** Lo que saldría de la caja, para decirlo antes de guardar. */
  total: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const sinCaja = !cargando && !caja;

  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <label
        className={`flex select-none items-center gap-2 text-sm ${
          sinCaja ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <Checkbox
          checked={checked && !!caja}
          disabled={!caja}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        Pagada con efectivo de la caja
      </label>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">
        {cargando
          ? "Buscando tu caja abierta..."
          : !caja
            ? "Abre tu caja en Finanzas para descontar el pago de ella."
            : checked
              ? `Se registrará una salida de ${formatMXN(total)} en tu caja${
                  caja.sucursal?.nombre ? ` de ${caja.sucursal.nombre}` : ""
                }.`
              : "Márcala si le pagas al proveedor con dinero del cajón."}
      </p>
    </div>
  );
}
