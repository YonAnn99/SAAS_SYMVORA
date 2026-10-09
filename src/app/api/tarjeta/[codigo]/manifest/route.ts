import { NextResponse } from "next/server";
import { obtenerTarjetaPublica } from "@/features/lealtad/tarjeta-publica.server";
import { paletaDeTarjeta } from "@/features/lealtad/lealtad";

/**
 * Manifest de UNA tarjeta de lealtad: con "Agregar a pantalla de inicio" el
 * acceso directo abre esa tarjeta (no el panel de SYMVORA) y lleva el nombre
 * del negocio. Publico como la tarjeta; `/api` no pasa por el middleware.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/tarjeta/[codigo]/manifest">) {
  const { codigo } = await ctx.params;
  const tarjeta = await obtenerTarjetaPublica(codigo);
  if (!tarjeta) {
    return NextResponse.json({ error: "Tarjeta no encontrada" }, { status: 404 });
  }

  const colores = paletaDeTarjeta(tarjeta.paleta, tarjeta.color_acento);
  const ruta = `/es/tarjeta/${tarjeta.codigo}`;

  return NextResponse.json(
    {
      name: `${tarjeta.programa} · ${tarjeta.negocio}`,
      short_name: tarjeta.negocio.slice(0, 12),
      id: ruta,
      start_url: ruta,
      scope: ruta,
      display: "standalone",
      background_color: colores.fondo,
      theme_color: colores.acento,
      icons: [
        ...(tarjeta.logo_url ? [{ src: tarjeta.logo_url, sizes: "any", purpose: "any" }] : []),
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    }
  );
}
