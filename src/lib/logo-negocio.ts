import { convertToWebP } from "@/lib/image";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * El logo del negocio vive SIEMPRE en el mismo archivo (`logos/<userId>/logo.webp`,
 * con `upsert`): el bucket no deja borrar, asi que un nombre nuevo por subida
 * dejaria archivos huerfanos. Pero con la misma URL nada se vuelve a pedir:
 * `next/image` guarda cada tamaño ya optimizado por URL (la barra lateral
 * seguia con el logo viejo mientras el header ya mostraba el nuevo), y el CDN
 * de Storage y el navegador tambien. Por eso `tenants.logo_url` se guarda con
 * una version (`?v=<momento de la subida>`): cada logo nuevo es una URL nueva.
 */

/** Pone (o reemplaza) la version `v` en la URL. */
export function conVersion(url: string, ahora: number = Date.now()): string {
  const u = new URL(url);
  u.searchParams.set("v", String(ahora));
  return u.toString();
}

/**
 * Convierte a WebP, sube y devuelve la URL publica CON version. Lanza un Error
 * con el mensaje de Storage si la subida falla.
 */
export async function subirLogoNegocio(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  userId: string,
  file: File
): Promise<string> {
  const webpFile = await convertToWebP(file);
  const filePath = `${userId}/logo.webp`;
  const { error } = await supabase.storage
    .from("logos")
    .upload(filePath, webpFile, { contentType: "image/webp", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("logos").getPublicUrl(filePath);
  return conVersion(data.publicUrl);
}
