import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Alto de la zona de la grafica; el esqueleto de `dynamic-charts` usa el mismo. */
export const ALTO_GRAFICA = "h-[220px] sm:h-[280px]";
/** Alto menor para graficas que van dentro de otra tarjeta (p. ej. Compras). */
export const ALTO_GRAFICA_CHICA = "h-[180px] sm:h-[220px]";

/**
 * Tarjeta comun: titulo, estado vacio y un contenedor con alto propio. Chart.js
 * (`maintainAspectRatio: false`) toma el alto de su padre, que debe ser
 * `relative` y tener alto fijo; sin eso el canvas crece sin fin.
 *
 * `simple` pinta solo el contenido (vacio o grafica), sin `Card`: para meter
 * graficas dentro de una tarjeta que ya existe sin anidar tarjetas.
 */
export function TarjetaGrafica({
  title,
  vacia,
  children,
  pie,
  sinContenedor = false,
  simple = false,
  alto = ALTO_GRAFICA,
}: {
  title: string;
  vacia: boolean;
  children: ReactNode;
  /** Contenido bajo la grafica (notas). */
  pie?: ReactNode;
  /** El hijo maneja su propio alto (p. ej. dona con leyenda al lado). */
  sinContenedor?: boolean;
  simple?: boolean;
  alto?: string;
}) {
  const contenido = (
    <>
      {vacia ? (
        <div
          className={`flex ${alto} items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground`}
        >
          Sin datos disponibles
        </div>
      ) : sinContenedor ? (
        children
      ) : (
        <div className={`relative w-full ${alto}`}>{children}</div>
      )}
      {!vacia && pie}
    </>
  );

  if (simple) {
    return (
      <div className="min-w-0">
        {title && <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>}
        {contenido}
      </div>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>{contenido}</CardContent>
    </Card>
  );
}
