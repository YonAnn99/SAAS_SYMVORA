import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CreditCard, Smartphone } from "lucide-react";
import { TarjetaVisual } from "@/features/lealtad/components/tarjeta-visual";
import { obtenerTarjetaPublica } from "@/features/lealtad/tarjeta-publica.server";
import { urlTarjeta } from "@/features/lealtad/lealtad";
import { qrSvg } from "@/features/lealtad/qr";

/**
 * Tarjeta de lealtad del cliente final (migracion 115). Publica: la abre el
 * cliente desde el enlace que le compartio el negocio, SIN cuenta. El
 * middleware la deja pasar sin sesion (`/tarjeta/`), y la consulta va con el
 * cliente anonimo y rate limit (`obtenerTarjetaPublica`).
 *
 * Dinamica: los sellos cambian con cada compra, nunca se sirve una copia vieja.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const tarjeta = await obtenerTarjetaPublica(codigo);
  return {
    title: tarjeta ? `${tarjeta.programa} · ${tarjeta.negocio}` : "Tarjeta de lealtad",
    // Cada tarjeta es de una persona: nada de buscadores.
    robots: { index: false, follow: false },
    // "Agregar a pantalla de inicio" abre ESTA tarjeta, con el nombre del negocio.
    manifest: tarjeta ? `/api/tarjeta/${tarjeta.codigo}/manifest` : undefined,
  };
}

export default async function TarjetaPage({ params }: Props) {
  const { locale, codigo } = await params;
  setRequestLocale(locale);

  const tarjeta = await obtenerTarjetaPublica(codigo);

  if (!tarjeta) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10 text-slate-900">
        <div className="max-w-sm space-y-3 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Tarjeta no encontrada</h1>
          <p className="text-sm text-slate-600">
            Revisa que el enlace esté completo o pídele al negocio que te lo comparta otra vez.
          </p>
        </div>
      </main>
    );
  }

  const svg = await qrSvg(urlTarjeta(tarjeta.codigo, locale));
  const oscura = tarjeta.paleta === "oscura";

  return (
    <main
      className={`flex min-h-dvh flex-col items-center gap-6 px-4 py-8 ${
        oscura ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      <TarjetaVisual
        datos={{
          negocio: tarjeta.negocio,
          logoUrl: tarjeta.logo_url,
          programa: tarjeta.programa,
          paleta: tarjeta.paleta,
          colorAcento: tarjeta.color_acento,
          sellos: tarjeta.sellos,
          sellosMeta: tarjeta.sellos_meta,
          premio: tarjeta.premio_descripcion,
          cliente: tarjeta.cliente,
          codigo: tarjeta.codigo,
          qrSvg: svg,
          activa: tarjeta.activa,
        }}
      />

      {/* Sin Wallet todavia: la tarjeta se guarda como acceso directo. */}
      <details
        className={`w-full max-w-md rounded-2xl border px-4 py-3 text-sm ${
          oscura ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Guárdala en tu celular
        </summary>
        <div className={`mt-3 space-y-2 ${oscura ? "text-slate-300" : "text-slate-600"}`}>
          <p>
            <span className="font-medium">Android (Chrome):</span> toca el menú ⋮ y elige «Agregar a la
            pantalla principal».
          </p>
          <p>
            <span className="font-medium">iPhone (Safari):</span> toca Compartir y elige «Agregar a
            inicio».
          </p>
          <p>Así la abres con un toque, como una app, y siempre ves tus sellos al día.</p>
        </div>
      </details>

      <p className={`text-xs ${oscura ? "text-slate-500" : "text-slate-400"}`}>Tarjeta digital por SYMVORA</p>
    </main>
  );
}
