import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Stamp } from "lucide-react";
import { TarjetaVisual } from "@/features/lealtad/components/tarjeta-visual";
import { FormularioAlta } from "@/features/lealtad/components/formulario-alta";
import { obtenerProgramaAlta } from "@/features/lealtad/alta-publica.server";

/**
 * Registro a la tarjeta de lealtad con el QR del local (migracion 121). La
 * abre el cliente final al escanear el cartel del mostrador, SIN cuenta: vive
 * bajo `/tarjeta/`, que el middleware ya deja pasar sin sesion.
 *
 * Dinamica: si el negocio apaga el registro o cambia el codigo, el cartel viejo
 * deja de servir al momento.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const programa = await obtenerProgramaAlta(codigo);
  return {
    title: programa ? `${programa.programa} · ${programa.negocio}` : "Tarjeta de lealtad",
    robots: { index: false, follow: false },
  };
}

export default async function UnirsePage({ params }: Props) {
  const { locale, codigo } = await params;
  setRequestLocale(locale);

  const programa = await obtenerProgramaAlta(codigo);

  if (!programa) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
        <div className="max-w-sm space-y-3 text-center">
          <Stamp className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Este registro no está disponible</h1>
          <p className="text-sm text-muted-foreground">
            Puede que el negocio lo haya pausado o cambiado. Pide tu tarjeta en caja y te la comparten al momento.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-5 bg-background px-4 py-8 text-foreground">
      {/* Asi se vera su tarjeta: el primer sello llega con su siguiente compra. */}
      <TarjetaVisual
        compacta
        datos={{
          negocio: programa.negocio,
          logoUrl: programa.logo_url,
          programa: programa.programa,
          paleta: programa.paleta,
          colorAcento: programa.color_acento,
          iconoSello: programa.icono_sello,
          colorFondo: programa.color_fondo,
          sellos: 0,
          sellosMeta: programa.sellos_meta,
          premio: programa.premio_descripcion,
        }}
      />

      <FormularioAlta
        codigoAlta={programa.codigo_alta}
        negocio={programa.negocio}
        avisoNegocioUrl={programa.aviso_privacidad_url}
      />

      <p className="text-xs text-muted-foreground">Tarjeta digital por SYMVORA</p>
    </main>
  );
}
