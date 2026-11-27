import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { Check, Circle, MapPin, PackageSearch, Phone } from "lucide-react";
import { obtenerPedidoPublico } from "@/features/catalogo/catalogo-publico.server";
import { ActualizarSeguimiento } from "@/features/catalogo/components/actualizar-seguimiento";
import { GuardarPedido } from "@/features/catalogo/components/guardar-pedido";
import { formatearPrecio } from "@/features/catalogo/pedido";
import { costoEnvioDeBase, textoEnvio, totalConEnvio } from "@/features/catalogo/envio";
import { monedaDe } from "@/lib/money";
import { formatearCantidad } from "@/lib/unidades";
import { urlWhatsApp } from "@/lib/whatsapp";

/**
 * Seguimiento de un pedido del catálogo (141-146), estilo «Progreso del pedido». Público y SIN cuenta: el código de 12
 * caracteres de la URL es el acceso. Se refresca solo mientras el pedido siga abierto. Fuera de buscadores y sin la URL
 * con el código en la analítica (`limpiarUrl`). Nunca muestra teléfono, dirección del cliente ni notas internas.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string; codigo: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Seguimiento de tu pedido", robots: { index: false, follow: false } };
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

export default async function SeguimientoPedidoPage({ params }: Props) {
  const { locale, slug: slugUrl, codigo } = await params;
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

  const cerrado = pedido.estado === "entregado" || pedido.estado === "cancelado";
  const cancelado = pedido.estado === "cancelado";
  const moneda = monedaDe(pedido.moneda);
  const color = pedido.color && /^#[0-9a-f]{6}$/i.test(pedido.color) ? pedido.color : "#1E3A8A";
  const colorEstado = pedido.estado_color && /^#[0-9a-f]{6}$/i.test(pedido.estado_color) ? pedido.estado_color : color;
  const whatsapp = (pedido.whatsapp ?? "").replace(/\D/g, "");
  const envio = pedido.entrega === "domicilio" ? costoEnvioDeBase(pedido.costo_envio) : null;
  const eventos = pedido.eventos.filter((e) => e.tipo !== "mensaje");
  const mapa = pedido.direccion_negocio
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.direccion_negocio)}`
    : null;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <ActualizarSeguimiento activo={!cerrado} />
      <GuardarPedido slug={pedido.slug ?? slugUrl} codigo={codigo} folio={pedido.folio} creado={pedido.creado_en} />
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="flex flex-col items-center gap-2 text-center">
          {pedido.logo_url ? (
            <Image src={pedido.logo_url} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
          ) : null}
          <p className="text-sm text-slate-500">{pedido.negocio}</p>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <PackageSearch className="h-5 w-5" aria-hidden="true" />
            Progreso del pedido #{pedido.folio}
          </h1>
        </header>

        <section className="space-y-3 rounded-2xl bg-white p-5 text-center shadow-sm">
          <span
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: colorEstado }}
            aria-hidden="true"
          >
            {cancelado ? <Circle className="h-6 w-6" /> : <Check className="h-6 w-6" />}
          </span>
          <p className="text-xl font-semibold" style={{ color: colorEstado }}>
            {pedido.estado_nombre}
          </p>
          <p className="text-xs text-slate-500">{fechaHora(pedido.actualizado_en ?? pedido.creado_en)}</p>

          {pedido.entrega === "recoger" && pedido.plazo_retiro_dias && !cerrado && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3 text-left text-sm">
              <span>
                Plazo para retirar el pedido: <strong>{pedido.plazo_retiro_dias} {pedido.plazo_retiro_dias === 1 ? "día" : "días"}</strong>
              </span>
              {mapa && (
                <a href={mapa} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-medium underline underline-offset-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Cómo llegar
                </a>
              )}
            </div>
          )}

          {pedido.entrega === "domicilio" && envio !== null && !cerrado && (
            <p className="text-sm text-slate-600">{textoEnvio(envio, moneda)}</p>
          )}
          {pedido.mensaje_cliente && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">{pedido.mensaje_cliente}</p>
          )}
        </section>

        {eventos.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Avance</h2>
            <ol className="space-y-3" aria-label="Avance de tu pedido">
              {eventos.map((e, i) => {
                const etiqueta = e.etiqueta === "nuevo" ? "Pedido recibido" : e.etiqueta;
                return (
                  <li key={`${e.en}-${i}`} className="flex items-start gap-3 text-sm">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color ?? color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{etiqueta}</span>
                      <span className="block text-xs text-slate-500">{fechaHora(e.en)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Detalles del pedido</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {pedido.items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                {it.imagen ? (
                  <Image src={it.imagen} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  {formatearCantidad(Number(it.cantidad), it.unidad ?? "PIEZA")} {it.nombre}
                  {it.variante ? ` (${it.variante})` : ""}
                </span>
                {it.precio != null && <span className="shrink-0">{formatearPrecio(it.precio * Number(it.cantidad), moneda)}</span>}
              </li>
            ))}
          </ul>
          {pedido.total != null && (
            <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
              <span>Total estimado</span>
              <span>{formatearPrecio(totalConEnvio(pedido.total, pedido.costo_envio) ?? pedido.total, moneda)}</span>
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {pedido.entrega === "domicilio" ? "Entrega a domicilio" : "Lo recoges en el negocio"} ·{" "}
            {pedido.pagado ? "Pagado" : "Pago pendiente"}. {pedido.negocio} confirma precio y disponibilidad.
          </p>
        </section>

        {whatsapp && (
          <a
            href={urlWhatsApp(whatsapp, `Hola, escribo por mi pedido #${pedido.folio}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: "#16a34a" }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            ¿Dudas? Escribe al negocio por WhatsApp
          </a>
        )}
        <p className="text-center text-xs text-slate-400">Guarda este enlace para ver el avance de tu pedido.</p>
      </div>
    </main>
  );
}
