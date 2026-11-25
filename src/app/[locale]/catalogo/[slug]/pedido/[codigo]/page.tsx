import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Check, PackageSearch } from "lucide-react";
import { obtenerPedidoPublico } from "@/features/catalogo/catalogo-publico.server";
import { ActualizarSeguimiento } from "@/features/catalogo/components/actualizar-seguimiento";
import {
  ETIQUETA_ESTADO_PUBLICO,
  esEstadoPedido,
  estadoFinal,
  pasosSeguimiento,
  type EstadoPedido,
} from "@/features/catalogo/pedido-envio";
import { formatearPrecio } from "@/features/catalogo/pedido";
import { monedaDe } from "@/lib/money";
import { formatearCantidad } from "@/lib/unidades";
import { urlWhatsApp } from "@/lib/whatsapp";

/**
 * Seguimiento de un pedido del catálogo (migración 141). Público y SIN cuenta: el código de 12 caracteres de la
 * URL es el acceso. Dinámico (el estado cambia desde el panel del negocio) y fuera de buscadores. La URL con el
 * código no sale a Vercel Analytics (`limpiarUrl`).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string; codigo: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Seguimiento de tu pedido", robots: { index: false, follow: false } };
}

export default async function SeguimientoPedidoPage({ params }: Props) {
  const { locale, codigo } = await params;
  setRequestLocale(locale);
  const pedido = await obtenerPedidoPublico(codigo);

  if (!pedido) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
        <div className="max-w-sm space-y-3 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Pedido no encontrado</h1>
          <p className="text-sm text-slate-600">Revisa que el enlace esté completo o escríbele al negocio.</p>
        </div>
      </main>
    );
  }

  const estado: EstadoPedido = esEstadoPedido(pedido.estado) ? pedido.estado : "nuevo";
  const cancelado = estado === "cancelado";
  const pasos = pasosSeguimiento(pedido.entrega);
  const indice = pasos.indexOf(estado);
  const moneda = monedaDe(pedido.moneda);
  const color = pedido.color && /^#[0-9a-f]{6}$/i.test(pedido.color) ? pedido.color : "#1E3A8A";
  const whatsapp = (pedido.whatsapp ?? "").replace(/\D/g, "");

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <ActualizarSeguimiento activo={!estadoFinal(estado)} />
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="text-center">
          <p className="text-sm text-slate-500">{pedido.negocio}</p>
          <h1 className="text-xl font-semibold">Pedido #{pedido.folio}</h1>
          <p
            className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${
              cancelado ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-800"
            }`}
          >
            {ETIQUETA_ESTADO_PUBLICO[estado]}
          </p>
        </header>

        {!cancelado && (
          <ol className="space-y-3 rounded-2xl bg-white p-5 shadow-sm" aria-label="Avance de tu pedido">
            {pasos.map((paso, i) => {
              const hecho = indice >= 0 && i <= indice;
              return (
                <li key={paso} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-white ${
                      hecho ? "border-transparent" : "border-slate-300 bg-white"
                    }`}
                    style={hecho ? { backgroundColor: color } : undefined}
                    aria-hidden="true"
                  >
                    {hecho && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className={hecho ? "font-medium" : "text-slate-400"}>
                    {paso === "nuevo" ? "Pedido recibido" : ETIQUETA_ESTADO_PUBLICO[paso]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Tu pedido</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {pedido.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  {formatearCantidad(Number(it.cantidad), it.unidad ?? "PIEZA")} {it.nombre}
                  {it.variante ? ` (${it.variante})` : ""}
                </span>
                {it.precio != null && (
                  <span className="shrink-0">{formatearPrecio(it.precio * Number(it.cantidad), moneda)}</span>
                )}
              </li>
            ))}
          </ul>
          {pedido.total != null && (
            <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
              <span>Total estimado</span>
              <span>{formatearPrecio(pedido.total, moneda)}</span>
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {pedido.entrega === "domicilio" ? "Entrega a domicilio" : "Lo recoges en el negocio"}. {pedido.negocio} confirma
            precio y disponibilidad.
          </p>
        </section>

        {whatsapp && (
          <a
            href={urlWhatsApp(whatsapp, `Hola, escribo por mi pedido #${pedido.folio}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: "#16a34a" }}
            className="flex h-12 w-full items-center justify-center rounded-2xl text-base font-semibold text-white"
          >
            Escribir al negocio por WhatsApp
          </a>
        )}
        <p className="text-center text-xs text-slate-400">Guarda este enlace para ver el avance de tu pedido.</p>
      </div>
    </main>
  );
}
