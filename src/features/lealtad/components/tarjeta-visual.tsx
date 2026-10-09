/**
 * La tarjeta de lealtad tal como la ve el cliente: logo y nombre del negocio,
 * cuadricula de sellos, barra de progreso, premio y QR.
 *
 * Sin hooks ni "use client": la usan la pagina publica (servidor) y la vista
 * previa del formulario en Clientes (cliente), y tienen que verse IGUAL.
 */
import { Check, Gift } from "lucide-react";
import { codigoAgrupado, paletaDeTarjeta, progreso, textoProgreso } from "../lealtad";
import type { PaletaTarjeta } from "../types";

export interface DatosTarjetaVisual {
  negocio: string;
  logoUrl: string | null;
  programa: string;
  paleta: PaletaTarjeta;
  colorAcento: string | null;
  sellos: number;
  sellosMeta: number;
  premio: string;
  /** Primer nombre del cliente; vacio en la vista previa sin cliente. */
  cliente?: string;
  codigo?: string;
  /** SVG del QR ya generado (`qrcode`). Sin el, no se pinta el bloque del QR. */
  qrSvg?: string | null;
  activa?: boolean;
}

function capitalizar(nombre: string): string {
  const n = nombre.trim().toLowerCase();
  return n ? n[0].toUpperCase() + n.slice(1) : "";
}

export function TarjetaVisual({ datos, compacta = false }: { datos: DatosTarjetaVisual; compacta?: boolean }) {
  const c = paletaDeTarjeta(datos.paleta, datos.colorAcento);
  const p = progreso(datos.sellos, datos.sellosMeta);
  const columnas = p.meta <= 5 ? p.meta : p.meta <= 10 ? 5 : p.meta <= 12 ? 6 : 8;
  const activa = datos.activa ?? true;
  const conPremio = activa && p.premiosDisponibles > 0;

  return (
    <div
      className={`w-full overflow-hidden rounded-3xl border shadow-xl ${compacta ? "max-w-sm" : "max-w-md"}`}
      style={{ backgroundColor: c.fondo, borderColor: c.borde, color: c.texto }}
    >
      {/* Encabezado: logo y negocio sobre una franja del acento. */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5" style={{ borderBottom: `1px solid ${c.borde}` }}>
        {datos.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={datos.logoUrl}
            alt={datos.negocio}
            className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
            style={{ backgroundColor: c.acento, color: c.sobreAcento }}
          >
            {datos.negocio.trim().charAt(0).toUpperCase() || "S"}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{datos.negocio}</p>
          <p className="truncate text-xs" style={{ color: c.textoSuave }}>
            {datos.programa}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        {datos.cliente && (
          <p className="text-sm" style={{ color: c.textoSuave }}>
            Hola, <span style={{ color: c.texto }} className="font-medium">{capitalizar(datos.cliente)}</span>
          </p>
        )}

        {/* Sellos: el ultimo lleva el regalo para que se entienda la meta. */}
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`${p.llenos} de ${p.meta} sellos`}
        >
          {Array.from({ length: p.meta }, (_, i) => {
            const lleno = i < p.llenos;
            const ultimo = i === p.meta - 1;
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-full transition-colors"
                style={
                  lleno
                    ? { backgroundColor: c.acento, color: c.sobreAcento }
                    : { backgroundColor: c.vacio, color: c.textoSuave, border: `2px dashed ${c.borde}` }
                }
              >
                {ultimo ? (
                  <Gift className="h-1/2 w-1/2" aria-hidden="true" />
                ) : lleno ? (
                  <Check className="h-1/2 w-1/2" strokeWidth={3} aria-hidden="true" />
                ) : (
                  <span className="text-[10px] font-medium opacity-70">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra y texto de progreso. */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: c.vacio }}>
            <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: c.acento }} />
          </div>
          <p className="text-sm font-medium">{textoProgreso(datos.sellos, datos.sellosMeta, datos.premio)}</p>
          {!conPremio && (
            <p className="text-xs" style={{ color: c.textoSuave }}>
              {p.faltan === 1 ? "¡Te falta 1 sello!" : `Te faltan ${p.faltan} sellos.`}
            </p>
          )}
        </div>

        {conPremio && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: c.acento, color: c.sobreAcento }}
          >
            <Gift className="h-5 w-5 shrink-0" aria-hidden="true" />
            Muéstrale este código al cajero para canjear tu premio.
          </div>
        )}

        {!activa && (
          <p className="rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: c.vacio, color: c.textoSuave }}>
            Esta tarjeta no está activa por ahora.
          </p>
        )}

        {datos.qrSvg && (
          <div className="flex flex-col items-center gap-2 pt-1">
            {/* Fondo blanco SIEMPRE: el escaner lee mal un QR sobre fondo oscuro. */}
            <div
              className="w-48 rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: datos.qrSvg }}
            />
            {datos.codigo && (
              <p className="font-mono text-sm tracking-widest" style={{ color: c.textoSuave }}>
                {codigoAgrupado(datos.codigo)}
              </p>
            )}
            <p className="text-xs" style={{ color: c.textoSuave }}>
              Muestra este código al pagar para sumar tu sello.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
