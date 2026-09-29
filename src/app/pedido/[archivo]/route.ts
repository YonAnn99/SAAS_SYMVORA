import { createSupabaseServiceRoleClient } from "@/lib/supabase/server.server";
import { FORMATO_CODIGO } from "@/features/inventory/codigo-enlace";

/**
 * El PDF de una orden de compra, con un enlace corto y de SYMVORA:
 * `https://www.symvora.com.mx/pedido/<codigo>.pdf` (migracion 095).
 *
 * Es lo que abre el proveedor desde WhatsApp, sin cuenta: por eso es publica.
 * Como la ruta termina en `.pdf`, el `matcher` de `src/proxy.ts` (que excluye
 * las rutas con punto) no le aplica ni la sesion ni el prefijo de idioma.
 *
 * El codigo (10 caracteres aleatorios) es la unica llave: sin el no hay forma
 * de llegar a un PDF, y el bucket es privado, asi que la URL de Supabase ya no
 * sirve por si sola.
 */
export const dynamic = "force-dynamic";

function noEncontrado() {
  return new Response("Este enlace no existe o ya no está disponible.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ archivo: string }> }
) {
  const { archivo } = await params;
  const codigo = archivo.replace(/\.pdf$/i, "");
  if (!archivo.toLowerCase().endsWith(".pdf") || !FORMATO_CODIGO.test(codigo)) {
    return noEncontrado();
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: enlace } = await supabase
    .from("pdf_enlaces")
    .select("ruta_storage, orden:ordenes_compra!orden_id(numero_orden)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!enlace) return noEncontrado();

  const { data: pdf, error } = await supabase.storage
    .from("ordenes-compra")
    .download(enlace.ruta_storage);
  if (error || !pdf) return noEncontrado();

  const orden = enlace.orden as unknown as { numero_orden: string } | null;
  // Solo caracteres seguros en el nombre del archivo.
  const nombre = `Orden-${(orden?.numero_orden ?? codigo).replace(/[^\w-]/g, "")}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`: se abre en el visor del telefono o del navegador; si se
      // descarga, lleva un nombre claro en vez del codigo.
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
