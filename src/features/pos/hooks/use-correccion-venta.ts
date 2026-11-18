"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { fetchDetalleVenta } from "@/features/sales/services/sales-history-service";
import { leerCorreccion, soltarCorreccion } from "@/features/sales/correccion";
import type { VentaGuardada } from "@/features/sales/sale-receipt-builder";
import { numeroOperacion } from "@/features/pos/ticket-format";

export interface CorreccionEnCurso {
  ventaId: string;
  motivo: string;
  /** Número de operación de la venta que se corrige, para la franja. */
  numero: string;
}

/**
 * Corregir una venta desde el Punto de Venta (migración 137).
 *
 * El detalle de la venta deja una corrección pendiente (`correccion.ts`). Aquí,
 * en cuanto el catálogo y el carrito guardado están listos (`listo`), se lee la
 * venta y la página la carga en el carrito con `cargar`. Al cobrar, la página
 * llama `corregir_venta` en vez de `complete_sale`.
 *
 * Se intenta UNA vez por montaje: si la venta ya no se puede corregir (otra
 * persona la canceló), se descarta y se avisa.
 */
export function useCorreccionVenta(
  userId: string | null,
  listo: boolean,
  cargar: (venta: VentaGuardada) => void
) {
  const t = useTranslations("pos.correct");
  const [correccion, setCorreccion] = useState<CorreccionEnCurso | null>(null);
  const intentada = useRef(false);
  // `cargar` cambia en cada pintado de la página; por ref, para que el efecto no
  // se cancele a medio camino cada vez.
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    if (!listo || intentada.current) return;
    const pendiente = leerCorreccion(userId);
    if (!pendiente) return;
    intentada.current = true;
    fetchDetalleVenta(pendiente.ventaId)
      .then((venta) => {
        if (venta.estado !== "COMPLETADA") {
          soltarCorreccion();
          toast.error(t("notAvailable"));
          return;
        }
        cargarRef.current(venta);
        setCorreccion({
          ventaId: venta.id,
          motivo: pendiente.motivo,
          numero: numeroOperacion(venta.id) ?? "",
        });
      })
      .catch(() => {
        soltarCorreccion();
        toast.error(t("loadError"));
      });
  }, [listo, userId, t]);

  /** Fin de la corrección: al cobrarla o al salir con la franja. */
  const terminar = useCallback(() => {
    soltarCorreccion();
    setCorreccion(null);
  }, []);

  return { correccion, terminar };
}
