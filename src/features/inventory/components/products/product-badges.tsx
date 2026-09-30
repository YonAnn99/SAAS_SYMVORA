"use client";

/**
 * Piezas de la fila de producto que comparten la tabla (escritorio) y la
 * lista deslizable (celular, `product-swipe-list.tsx`).
 */

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { stockStatus } from "@/features/inventory/stock-status";

/**
 * Etiqueta de stock, en CUATRO estados.
 *
 * Antes eran dos (`stock <= minimo ? "Stock bajo" : "OK"`), lo que mostraba un
 * producto agotado como "Stock bajo" — y el filtro del diálogo lo clasificaba
 * como "Agotado". Ahora ambos leen de `stockStatus()`, así que no pueden
 * contradecirse.
 *
 * El cuarto es "Servicio": una asesoría o un envío a domicilio salían con la
 * etiqueta roja de "Agotado" porque nadie miraba `es_servicio`.
 */
export function StockBadge({
  product,
}: {
  product: { stock_actual: number; stock_minimo: number; es_servicio?: boolean };
}) {
  const status = stockStatus(product);

  if (status === "servicio") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        Servicio
      </Badge>
    );
  }

  if (status === "agotado") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        Agotado
      </Badge>
    );
  }

  if (status === "bajo") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
      >
        Stock bajo
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className="text-[10px] px-1.5 py-0 bg-[#EDF3EC] text-[#346538] dark:bg-[#346538]/20 dark:text-[#7BC67E]"
    >
      OK
    </Badge>
  );
}

/**
 * El corazón de favoritos.
 *
 * SOBRE EL RELLENO: cuando está marcado se pinta con `fill-current` sobre
 * `text-foreground`, que en el tema oscuro ES BLANCO y en el claro casi negro.
 * Un blanco fijo (`fill-white`) cumpliría lo pedido a la vista en oscuro pero
 * desaparecería por completo sobre el fondo claro.
 *
 * Va a `h-7`, la misma altura que Editar y la papelera, para que la fila no
 * cambie de alto.
 */
export function FavoriteButton({
  esFavorito,
  onToggle,
  nombre,
}: {
  esFavorito: boolean;
  onToggle: () => void;
  nombre: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-1.5 text-xs"
      onClick={onToggle}
      aria-pressed={esFavorito}
      aria-label={
        esFavorito
          ? `Quitar ${nombre} de favoritos`
          : `Marcar ${nombre} como favorito`
      }
      title={esFavorito ? "Quitar de favoritos" : "Marcar como favorito"}
    >
      <Heart
        className={`h-3.5 w-3.5 ${
          esFavorito
            ? "fill-current text-foreground"
            : "text-muted-foreground"
        }`}
      />
    </Button>
  );
}
