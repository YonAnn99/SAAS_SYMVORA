import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Store } from "lucide-react";
import { obtenerCatalogoPublico } from "@/features/catalogo/catalogo-publico.server";
import { CatalogoVista } from "@/features/catalogo/components/catalogo-vista";
import { urlCatalogo } from "@/features/catalogo/slug";

/**
 * Catálogo en línea de un negocio (migración 124). Público, en www y sin
 * cuenta: lo comparte el negocio con sus clientes. El middleware lo trata como
 * página de marketing (`/catalogo` en `MARKETING_SEGMENTS`) y la consulta va con
 * el cliente anónimo y rate limit (`obtenerCatalogoPublico`).
 *
 * Dinámica: precios y disponibilidad cambian con cada venta o compra.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const datos = await obtenerCatalogoPublico(slug);
  if (!datos) {
    return { title: "Catálogo no encontrado", robots: { index: false, follow: false } };
  }
  const { encabezado, pagina } = datos;
  const titulo = `${encabezado.negocio} · Catálogo`;
  const descripcion =
    encabezado.mensaje ??
    `Consulta los productos de ${encabezado.negocio} y haz tu pedido por WhatsApp.`;
  const imagen = encabezado.logo_url ?? pagina.productos.find((p) => p.imagen_url)?.imagen_url ?? undefined;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: urlCatalogo(encabezado.slug ?? slug, locale) },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: urlCatalogo(encabezado.slug ?? slug, locale),
      type: "website",
      ...(imagen ? { images: [{ url: imagen }] } : {}),
    },
    // Lo publica el negocio para que lo encuentren: se puede indexar.
    robots: { index: true, follow: true },
  };
}

export default async function CatalogoPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const datos = await obtenerCatalogoPublico(slug);

  if (!datos) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
        <div className="max-w-sm space-y-3 text-center">
          <Store className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Catálogo no disponible</h1>
          <p className="text-sm text-slate-600">
            Revisa que el enlace esté completo o pídele al negocio que te lo comparta otra vez.
          </p>
        </div>
      </main>
    );
  }

  return <CatalogoVista encabezado={datos.encabezado} paginaInicial={datos.pagina} />;
}
