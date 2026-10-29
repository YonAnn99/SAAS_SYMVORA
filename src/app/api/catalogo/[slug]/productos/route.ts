import { NextResponse } from "next/server";
import {
  consultarProductosCatalogo,
  permitirConsultaCatalogo,
} from "@/features/catalogo/catalogo-publico.server";

/**
 * Búsqueda, categoría y "Cargar más" del catálogo en línea (migración 124).
 * Pública como la página; `/api` no pasa por el middleware. Solo lectura: el
 * pedido sale por WhatsApp, nunca por aquí.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cabeceras = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  if (!(await permitirConsultaCatalogo(request.headers))) {
    return NextResponse.json({ error: "Demasiadas consultas. Espera un momento." }, { status: 429, headers: cabeceras });
  }

  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const pagina = await consultarProductosCatalogo(slug.toLowerCase(), {
    busqueda: url.searchParams.get("q"),
    categoria: url.searchParams.get("categoria"),
    offset: Number.isFinite(offset) ? offset : 0,
  });
  if (!pagina) {
    return NextResponse.json({ error: "Catálogo no encontrado" }, { status: 404, headers: cabeceras });
  }
  return NextResponse.json(pagina, { headers: cabeceras });
}
