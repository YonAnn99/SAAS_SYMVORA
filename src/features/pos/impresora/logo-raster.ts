/**
 * El logo del negocio como imagen de 1 bit para la termica (`GS v 0`).
 *
 * Se dibuja en un canvas a la mitad del ancho imprimible (como el logo del
 * ticket en pantalla, que no ocupa todo el papel) y cada punto queda negro si
 * es oscuro y no transparente. Si la imagen no carga (sin logo, sin red,
 * CORS), devuelve `null` y el ticket sale sin logo en lugar de fallar.
 */

import { PUNTOS, type AnchoPapel } from "./escpos";
import type { LogoTicket } from "./ticket-escpos";

const ALTO_MAXIMO = 120;

const cache = new Map<string, LogoTicket | null>();

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar el logo"));
    img.src = url;
  });
}

export async function logoParaTicket(
  url: string | null | undefined,
  ancho: AnchoPapel
): Promise<LogoTicket | null> {
  if (!url || typeof document === "undefined") return null;
  const clave = `${ancho}|${url}`;
  if (cache.has(clave)) return cache.get(clave) ?? null;

  try {
    const img = await cargarImagen(url);
    const maxAncho = Math.floor(PUNTOS[ancho] / 2);
    const escala = Math.min(maxAncho / img.width, ALTO_MAXIMO / img.height, 1);
    // Ancho multiplo de 8: cada byte son 8 puntos horizontales.
    const w = Math.max(8, Math.floor((img.width * escala) / 8) * 8);
    const h = Math.max(1, Math.round(img.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sin canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const anchoBytes = w / 8;
    const datos = new Uint8Array(anchoBytes * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const luminancia = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luminancia < 128) {
          datos[y * anchoBytes + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    const logo = { datos, anchoBytes, alto: h };
    cache.set(clave, logo);
    return logo;
  } catch {
    cache.set(clave, null);
    return null;
  }
}
